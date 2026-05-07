import { supabase } from '../supabase';

export interface StorageFile {
  name: string;
  id: string;
  updated_at: string;
  created_at: string;
  last_accessed_at: string;
  metadata: {
    size: number;
    mimetype: string;
    cacheControl: string;
  };
  url?: string;
}

export interface Bucket {
  id: string;
  name: string;
  owner: string;
  public: boolean;
  file_size_limit?: number;
  allowed_mime_types?: string[];
  created_at: string;
  updated_at: string;
}

const SERVICE_NAME = 'StorageService';

export const fetchBuckets = async (): Promise<Bucket[]> => {
  try {
    const { data, error } = await supabase.storage.listBuckets();
    if (error) throw error;
    return data || [];
  } catch (error: any) {
    console.error(`[${SERVICE_NAME}] Error fetching buckets:`, error);
    throw error;
  }
};

export const fetchFiles = async (bucketName: string, path: string = ''): Promise<StorageFile[]> => {
  try {
    const { data, error } = await supabase.storage.from(bucketName).list(path, {
        limit: 100,
        offset: 0,
        sortBy: { column: 'name', order: 'asc' }
    });
    if (error) throw error;
    
    const files = (data || []).filter(item => !!item.id) as StorageFile[];
    
    const filesWithUrls = files.map(file => {
        const { data: urlData } = supabase.storage.from(bucketName).getPublicUrl(`${path}${path ? '/' : ''}${file.name}`);
        return { ...file, url: urlData.publicUrl };
    });

    return filesWithUrls;
  } catch (error: any) {
    console.error(`[${SERVICE_NAME}] Error fetching files:`, error);
    throw error;
  }
};

export const uploadFile = async (bucketName: string, file: File, path: string = ''): Promise<string> => {
  try {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 7)}.${fileExt}`;
    const filePath = path ? `${path}/${fileName}` : fileName;

    const { error: uploadError } = await supabase.storage.from(bucketName).upload(filePath, file);
    if (uploadError) throw uploadError;

    const { data: urlData } = supabase.storage.from(bucketName).getPublicUrl(filePath);
    return urlData.publicUrl;
  } catch (error: any) {
    console.error(`[${SERVICE_NAME}] Error uploading file:`, error);
    throw error;
  }
};

export const deleteFile = async (bucketName: string, filePath: string): Promise<void> => {
  try {
    const { error } = await supabase.storage.from(bucketName).remove([filePath]);
    if (error) throw error;
  } catch (error: any) {
    console.error(`[${SERVICE_NAME}] Error deleting file:`, error);
    throw error;
  }
};
