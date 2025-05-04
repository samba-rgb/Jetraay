// Types and interfaces shared across components

export interface HeaderItem {
  id: number;
  enabled: boolean;
  key: string;
  value: string;
}

export interface FormDataItem {
  id: number;
  enabled: boolean;
  key: string;
  value: string;
  type: 'text' | 'file';
  file?: File | null;
}

export type BodyMode = 'none' | 'form-data' | 'urlencoded' | 'raw' | 'binary' | 'graphql';
export type RawContentType = 'text/plain' | 'application/json' | 'application/xml' | 'text/html' | 'application/javascript';
export type ResponseTab = 'body' | 'headers' | 'cookies';
export type ResponseFormat = 'pretty' | 'raw' | 'preview';

// Define types for Jet and Action
export interface Jet {
  id: string;
  name?: string;
  method: string;
  url: string;
  headers: string[];
  body?: string;
}

export type Action = "delete" | "clone" | "rename";