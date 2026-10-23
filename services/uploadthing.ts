// UploadThing client for React Native / Expo.
//
// Two things make this different from the web setup and both were broken before:
//
//  1. URL. On the web, `generateReactHelpers()` infers the backend URL from the
//     current origin - there is no origin in React Native, so without an
//     explicit absolute URL every upload silently failed. We must pass the
//     absolute backend URL explicitly.
//
//  2. Entry point. Import from `@uploadthing/react/native`, not
//     `@uploadthing/react` - the default entry pulls in the DOM
//     UploadButton/UploadDropzone components.
//
// The presign request goes to `<url>` and needs the NextAuth session cookie;
// React Native's global `fetch` sends cookies from the same native cookie jar
// the rest of the app already uses, so no extra credentials handling is needed.
import { generateReactHelpers } from "@uploadthing/react/native";
import type { ImagePickerAsset } from "expo-image-picker";

const API_URL = "https://www.bukonzounitedteacherscooperativesociety.com";

export const { useUploadThing, uploadFiles } = generateReactHelpers({
  url: `${API_URL}/api/uploadthing`,
});

// The shape UploadThing's client expects for a native file. Unlike a browser
// `File`, it still needs `size` up front for the presign step - an ImagePicker
// asset usually carries `fileSize`, but it can be missing on iOS, so fall back
// to reading the blob.
export type NativeUploadFile = {
  uri: string;
  name: string;
  type: string;
  size: number;
};

export async function assetToUploadFile(
  asset: ImagePickerAsset,
  fallbackName: string,
): Promise<NativeUploadFile> {
  const type = asset.mimeType || "image/jpeg";
  const name =
    asset.fileName || `${fallbackName}.${type.split("/")[1] || "jpg"}`;

  let size = asset.fileSize ?? 0;
  if (!size) {
    try {
      const res = await fetch(asset.uri);
      const blob = await res.blob();
      size = blob.size;
    } catch {
      // Leave size as 0 - the server will still accept small images; this is
      // only a problem for the progress indicator and edge-case size limits.
    }
  }

  return { uri: asset.uri, name, type, size };
}
