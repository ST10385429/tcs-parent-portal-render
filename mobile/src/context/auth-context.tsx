import { onAuthStateChanged } from "firebase/auth";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { auth } from "@/lib/firebase-auth";

import {
  getUserProfile,
  logoutUser,
} from "@/services/auth-service";

import { type AppUser } from "@/types/auth";

type AuthContextValue = {
  user: AppUser | null;
  isLoading: boolean;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
};

type AuthProviderProps = {
  children: ReactNode;
};

const AuthContext = createContext<
  AuthContextValue | undefined
>(undefined);

export function AuthProvider({
  children,
}: AuthProviderProps) {
  const [user, setUser] =
    useState<AppUser | null>(null);

  const [isLoading, setIsLoading] =
    useState(true);

  const refreshUser =
    useCallback(async () => {
      const firebaseUser =
        auth.currentUser;

      if (!firebaseUser) {
        setUser(null);
        return;
      }

      const refreshedProfile =
        await getUserProfile(
          firebaseUser,
        );

      setUser(refreshedProfile);
    }, []);

  useEffect(() => {
    let isMounted = true;

    const unsubscribe =
      onAuthStateChanged(
        auth,
        async (firebaseUser) => {
          if (!isMounted) {
            return;
          }

          if (!firebaseUser) {
            setUser(null);
            setIsLoading(false);
            return;
          }

          try {
            const userProfile =
              await getUserProfile(
                firebaseUser,
              );

            if (isMounted) {
              setUser(userProfile);
            }
          } catch (error) {
            console.error(
              "Unable to load the signed-in user:",
              error,
            );

            await logoutUser();

            if (isMounted) {
              setUser(null);
            }
          } finally {
            if (isMounted) {
              setIsLoading(false);
            }
          }
        },
      );

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  const contextValue =
    useMemo<AuthContextValue>(
      () => ({
        user,
        isLoading,
        logout: logoutUser,
        refreshUser,
      }),
      [
        user,
        isLoading,
        refreshUser,
      ],
    );

  return (
    <AuthContext.Provider
      value={contextValue}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context =
    useContext(AuthContext);

  if (!context) {
    throw new Error(
      "useAuth must be used inside an AuthProvider.",
    );
  }

  return context;
}