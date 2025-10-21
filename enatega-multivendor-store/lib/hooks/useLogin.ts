import { ApolloError, useMutation, useQuery } from "@apollo/client";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { useContext, useState } from "react";

import { Href, router } from "expo-router";
import {
  DEFAULT_STORE_CREDS,
  STORE_LOGIN,
} from "../api/graphql/mutation/login";
import { AuthContext } from "../context/global/auth.context";
import { setItem } from "../services";
import { FlashMessageComponent } from "../ui/useable-components";
import { ROUTES } from "../utils/constants";
import { IStoreLoginCompleteResponse } from "../utils/interfaces/auth.interface";
import { signInVendor, getVendorProfile } from "../supabase";

const useLogin = () => {
  const [creds, setCreds] = useState({ username: "", password: "" });
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Context
  const { setTokenAsync } = useContext(AuthContext);

  // API
  const [login, { data: storeLoginData }] = useMutation(STORE_LOGIN, {
    onCompleted,
    onError,
  });

  useQuery(DEFAULT_STORE_CREDS, { onCompleted, onError });

  // Handlers
  async function onCompleted({
    restaurantLogin,
    lastOrderCreds,
  }: IStoreLoginCompleteResponse) {
    console.log("🚀 ~ onCompleted called with:", { restaurantLogin, lastOrderCreds });
    
    setIsLoading(false);
    
    if (restaurantLogin) {
      await setItem("store-id", restaurantLogin?.restaurantId);
      await setTokenAsync(restaurantLogin?.token);
      router.replace(ROUTES.home as Href);
    } else if (
      lastOrderCreds &&
      lastOrderCreds?.restaurantUsername &&
      lastOrderCreds?.restaurantPassword
    ) {
      setCreds({
        username: lastOrderCreds?.restaurantUsername,
        password: lastOrderCreds?.restaurantPassword,
      });
    }
  }

  function onError(err: ApolloError) {
    console.log("🚀 ~ onError called with:", { err });
    const error = err as ApolloError;
    setIsLoading(false);
    FlashMessageComponent({
      message:
        error?.graphQLErrors?.[0]?.message ??
        error?.networkError?.message ??
        "Something went wrong",
    });
  }

  const onLogin = async (username: string, password: string) => {
    console.log("🚀 ~ onLogin SUPABASE called with:", { username, password: "***" });

    try {
      setIsLoading(true);

      // Validate inputs
      if (!username || !password) {
        throw new Error("Username and password are required");
      }

      // ✅ USAR SUPABASE EN LUGAR DE GRAPHQL
      const data = await signInVendor(username, password);
      console.log("✅ Supabase login successful:", data.user.email);

      // Obtener perfil del vendor con sus restaurantes
      const profile = await getVendorProfile();
      console.log("✅ Vendor profile:", profile);

      if (profile.restaurants && profile.restaurants.length > 0) {
        const restaurantId = profile.restaurants[0].id;
        await AsyncStorage.setItem("store-id", restaurantId);
        await setTokenAsync(data.session?.access_token || '');
        console.log("✅ Stored restaurant ID:", restaurantId);

        setIsLoading(false);
        router.replace(ROUTES.home as Href);
      } else {
        throw new Error("No restaurants found for this vendor");
      }

    } catch (err: any) {
      console.error("❌ Login error:", err);
      setIsLoading(false);

      FlashMessageComponent({
        message: err?.message || "Error al iniciar sesión. Verifica tus credenciales.",
      });
    }
  };

  return {
    creds,
    onLogin,
    isLogging: isLoading,
  };
};

export default useLogin;