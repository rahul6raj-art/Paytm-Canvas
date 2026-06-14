interface FontData {
  family: string;
  fullName: string;
  postscriptName: string;
  style: string;
  blob(): Promise<Blob>;
}

interface QueryLocalFontsOptions {
  postscriptNames?: string[];
}

interface Window {
  queryLocalFonts?: (options?: QueryLocalFontsOptions) => Promise<FontData[]>;
}
