import { Asset } from "expo-asset";
import * as FileSystem from "expo-file-system/legacy";
import { Platform } from "react-native";

const tcsLogoAsset = Asset.fromModule(
  require("../../assets/images/tcs-logo.jpeg"),
);

let cachedLogoDataUri: string | null = null;

export async function getTcsLogoDataUri(): Promise<string> {
  if (cachedLogoDataUri) {
    return cachedLogoDataUri;
  }

  await tcsLogoAsset.downloadAsync();

  if (Platform.OS === "web") {
    cachedLogoDataUri = tcsLogoAsset.uri;
    return cachedLogoDataUri;
  }

  const localUri = tcsLogoAsset.localUri;

  if (!localUri) {
    throw new Error(
      "The TCS logo could not be loaded for the document.",
    );
  }

  const base64 = await FileSystem.readAsStringAsync(
    localUri,
    {
      encoding: FileSystem.EncodingType.Base64,
    },
  );

  cachedLogoDataUri = `data:image/jpeg;base64,${base64}`;

  return cachedLogoDataUri;
}
