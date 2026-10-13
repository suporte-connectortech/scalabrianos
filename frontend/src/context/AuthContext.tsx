import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

export type UserRole = 
  | 'ADMIN_GERAL' 
  | 'ADMINISTRADOR' 
  | 'COLABORADOR' 
  | 'INTERMITENTE' 
  | 'PADRE' 
  | 'REGISTRO_REGIONAL'
  | 'SUPERIOR_REGIONAL'
  | 'SECRETARIO_REGIONAL'
  | 'ECONOMO_REGIONAL'
  | 'SECRETARIADO_MISSAO'
  | 'SECRETARIADO_VIDA_RELIGIOSA'
  | 'SECRETARIADO_FORMACAO'
  | 'SUPERIOR_LOCAL'
  | 'ECONOMO_LOCAL'
  | 'MISSIONARIO';

interface User {
    id: number;
    nome: string;
    email: string;
    role: UserRole;
    situacao?: string;
    is_oconomo?: boolean;
    is_superior?: boolean;
    casa_id?: number | null;
    foto_perfil?: string;
}

interface AuthContextType {
    user: User | null;
    userRole: UserRole | null;
    token: string | null;
    login: (userData: User, token: string) => void;
    logout: () => void;
    canEdit: boolean;
    isAdminGeral: boolean;
    isPadre: boolean;
    isOconomo: boolean;
    isSuperior: boolean;
    isRegional: boolean;
    canAccessObito: boolean;
    isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(() => {
        const savedUser = localStorage.getItem('user');
        return savedUser ? JSON.parse(savedUser) : null;
    });
    const [token, setToken] = useState<string | null>(localStorage.getItem('token'));

    useEffect(() => {
        if (!user && token) {
            const savedUser = localStorage.getItem('user');
            if (savedUser) {
                setUser(JSON.parse(savedUser));
            }
        }
    }, [token, user]);

    const login = (userData: User, authToken: string) => {
        setUser(userData);
        setToken(authToken);
        localStorage.setItem('token', authToken);
        localStorage.setItem('user', JSON.stringify(userData));
    };

    const logout = () => {
        setUser(null);
        setToken(null);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
    };

    const userRole = user?.role || null;
    const isAdminGeral = userRole === 'ADMIN_GERAL';
    const isPadre = userRole === 'PADRE' || userRole === 'MISSIONARIO';
    const isOconomo = ((isPadre || isAdminGeral) && !!user?.is_oconomo) || userRole === 'ECONOMO_LOCAL' || userRole === 'ECONOMO_REGIONAL';
    const isSuperior = !!user?.is_superior || userRole === 'SUPERIOR_LOCAL' || userRole === 'SUPERIOR_REGIONAL';
    const isRegional = [
        'REGISTRO_REGIONAL',
        'SUPERIOR_REGIONAL',
        'SECRETARIO_REGIONAL',
        'ECONOMO_REGIONAL',
        'SECRETARIADO_MISSAO',
        'SECRETARIADO_VIDA_RELIGIOSA',
        'SECRETARIADO_FORMACAO'
    ].includes(userRole || '');
    const canEdit = isAdminGeral || userRole === 'ADMINISTRADOR' || isRegional;
    // Death records (óbito) are restricted to Registro Regional (and the system superuser)
    const canAccessObito = userRole === 'REGISTRO_REGIONAL' || isAdminGeral;
    const isAuthenticated = !!token;

    return (
        <AuthContext.Provider value={{ 
            user, 
            userRole, 
            token, 
            login, 
            logout, 
            canEdit, 
            isAdminGeral,
            isPadre,
            isOconomo,
            isSuperior,
            isRegional,
            canAccessObito,
            isAuthenticated 
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
