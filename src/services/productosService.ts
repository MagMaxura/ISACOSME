import { supabase } from '../supabase';
import { Producto, Lote, SimpleProducto, StockPorDeposito } from '../types';
import { PostgrestError } from '@supabase/supabase-js';

const SERVICE_NAME = 'ProductosService';

export const fetchProductosConStock = async (): Promise<Producto[]> => {
    console.log(`[${SERVICE_NAME}] Fetching products, lots, and deposits.`);
    try {
        const { data: productosData, error: pError } = await supabase
            .from('productos')
            .select('*')
            .order('created_at', { ascending: false });

        if (pError) {
            (pError as any).table = 'productos';
            throw pError;
        }

        const { data: lotesData, error: lError } = await supabase
            .from('lotes')
            .select('*, depositos(nombre)')
            .order('fecha_vencimiento', { ascending: true });


        if (lError) {
             (lError as any).table = 'lotes';
            throw lError;
        }
        
        console.log(`[${SERVICE_NAME}] Successfully fetched ${productosData.length} products and ${lotesData.length} lots.`);

        const transformedProductos: Producto[] = productosData.map(p => {
            const productoLotes = lotesData.filter(l => l.producto_id === p.id);
            const stockTotal = productoLotes.reduce((sum, lote) => sum + lote.cantidad_actual, 0);
            
            const stockPorDepositoMap = new Map<string, StockPorDeposito>();

            productoLotes.forEach(l => {
                const depositoId = l.deposito_id;
                const depositoNombre = (l.depositos as any)?.nombre || 'Indefinido';

                const loteTyped: Lote = {
                    id: l.id,
                    numero_lote: l.numero_lote,
                    cantidad_inicial: l.cantidad_inicial,
                    cantidad_actual: l.cantidad_actual,
                    fecha_vencimiento: l.fecha_vencimiento,
                    costo_laboratorio: l.costo_laboratorio,
                    deposito_id: l.deposito_id,
                    depositoNombre: depositoNombre,
                };

                if (!stockPorDepositoMap.has(depositoId)) {
                    stockPorDepositoMap.set(depositoId, {
                        depositoId: depositoId,
                        depositoNombre: depositoNombre,
                        stock: 0,
                        lotes: [],
                    });
                }
                
                const depositoData = stockPorDepositoMap.get(depositoId)!;
                depositoData.stock += l.cantidad_actual;
                depositoData.lotes.push(loteTyped);
            });

            return {
                id: p.id,
                nombre: p.nombre,
                codigoBarras: p.codigo_barras,
                descripcion: p.descripcion,
                precioPublico: p.precio_publico ?? 0,
                precioComercio: p.precio_comercio ?? 0,
                precioMayorista: p.precio_mayorista ?? 0,
                imagenUrl: p.imagen_url,
                costoInsumos: p.costo_insumos,
                linea: p.linea,
                boxLengthCm: p.box_length_cm,
                boxWidthCm: p.box_width_cm,
                boxHeightCm: p.box_height_cm,
                productWeightKg: p.product_weight_kg,
                productsPerBox: p.products_per_box,
                stock: stockTotal, // for backwards compatibility
                stockTotal: stockTotal,
                lotes: productoLotes.map(l => ({
                    id: l.id,
                    numero_lote: l.numero_lote,
                    cantidad_inicial: l.cantidad_inicial,
                    cantidad_actual: l.cantidad_actual,
                    fecha_vencimiento: l.fecha_vencimiento,
                    costo_laboratorio: l.costo_laboratorio,
                    deposito_id: l.deposito_id,
                    depositoNombre: (l.depositos as any)?.nombre || 'Indefinido'
                })),
                stockPorDeposito: Array.from(stockPorDepositoMap.values()),
                insumos: [], // Insumos data can be fetched on demand or joined
            };
        });
        
        console.log(`[${SERVICE_NAME}] Data transformation complete.`);
        return transformedProductos;
    } catch (error: any) {
        const tableName = error.table ? ` en la tabla '${error.table}'` : '';
        console.error(`[${SERVICE_NAME}] Error fetching products${tableName}:`, error.message);
        if (error.message?.includes('security policy') || error.message?.includes('does not exist')) {
            throw new Error(`Error de permisos (RLS)${tableName}. Por favor, revisa las políticas de seguridad en la base de datos.`);
        }
        throw error;
    }
};

export const fetchPublicProductsList = async (): Promise<Partial<Producto>[]> => {
    console.log(`[${SERVICE_NAME}] Fetching public products list.`);
    try {
        const { data, error } = await supabase
            .from('productos')
            .select('id, nombre, descripcion, precio_publico, imagen_url, linea, codigo_barras')
            .order('nombre', { ascending: true });

        if (error) {
            throw error;
        }

        return (data || []).map(p => ({
            id: p.id,
            nombre: p.nombre,
            descripcion: p.descripcion,
            precioPublico: p.precio_publico ?? 0,
            imagenUrl: p.imagen_url,
            linea: p.linea,
            codigoBarras: p.codigo_barras,
        }));
    } catch (error: any) {
        console.error(`[${SERVICE_NAME}] Error fetching public products. Raw error:`, JSON.stringify(error, null, 2));

        if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
            const enhancedError = {
                message: "Error de Permisos: La lista pública de productos no se puede mostrar.",
                details: "El error de red 'Failed to fetch' oculta un problema de permisos en la base de datos. La tabla 'productos' tiene la Seguridad a Nivel de Fila (RLS) activada, pero no existe una política que permita a los usuarios no autenticados (rol 'anon') leer los datos. El servidor rechaza la solicitud y, como resultado, el navegador la bloquea por un error de CORS.",
                hint: "SOLUCIÓN PARA ADMINISTRADORES: Ejecute el siguiente comando SQL en su editor de SQL de Supabase para crear la política de seguridad necesaria:\n\nCREATE POLICY \"Public products are viewable by everyone.\" ON public.productos FOR SELECT TO anon USING (true);"
            };
            throw enhancedError;
        }

        if (error.message && (error.message.includes('security policy') || error.message.includes('does not exist'))) {
            const enhancedError = {
                ...error,
                message: `Error de permisos (RLS) en la tabla 'productos'.`,
                details: error.message,
                hint: `Asegúrese de que exista una política de seguridad (RLS) que permita al rol 'anon' realizar operaciones de LECTURA (SELECT) en la tabla 'productos'.`
            };
            throw enhancedError;
        }
        
        throw error;
    }
}

export const fetchProductosParaVenta = async (): Promise<SimpleProducto[]> => {
    console.log(`[${SERVICE_NAME}] Fetching products for sale.`);
    try {
         const { data, error } = await supabase
            .from('productos')
            .select('id, nombre, codigo_barras, precio_publico, precio_comercio, precio_mayorista');

        if (error) throw error;
        
        // Fetch real stock
        const { data: lotesData, error: lotesError } = await supabase.from('lotes').select('producto_id, cantidad_actual');
        if (lotesError) throw lotesError;

        const stockMap = new Map<string, number>();
        for (const lote of lotesData) {
            stockMap.set(lote.producto_id, (stockMap.get(lote.producto_id) || 0) + lote.cantidad_actual);
        }

        return (data || []).map(p => ({
            id: p.id,
            nombre: p.nombre,
            codigoBarras: p.codigo_barras,
            stockTotal: stockMap.get(p.id) || 0,
            precioPublico: p.precio_publico ?? 0,
            precioComercio: p.precio_comercio ?? 0,
            precioMayorista: p.precio_mayorista ?? 0,
        }));
    } catch(error: any) {
        console.error(`[${SERVICE_NAME}] Error fetching products for sale:`, error.message);
        throw error;
    }
}


// Fetches a list of products for selectors with all data for SimpleProducto type
export const fetchSimpleProductos = async (): Promise<SimpleProducto[]> => {
    console.log(`[${SERVICE_NAME}] Fetching simple product list.`);
    try {
        const { data, error } = await supabase
            .from('productos')
            .select('id, nombre, codigo_barras, precio_publico, precio_comercio, precio_mayorista')
            .order('nombre', { ascending: true });

        if (error) throw error;
        
        // Fetch real stock
        const { data: lotesData, error: lotesError } = await supabase.from('lotes').select('producto_id, cantidad_actual');
        if (lotesError) throw lotesError;

        const stockMap = new Map<string, number>();
        for (const lote of lotesData) {
            stockMap.set(lote.producto_id, (stockMap.get(lote.producto_id) || 0) + lote.cantidad_actual);
        }

        const simpleProductos: SimpleProducto[] = (data || []).map(p => ({
            id: p.id,
            nombre: p.nombre,
            codigoBarras: p.codigo_barras,
            stockTotal: stockMap.get(p.id) || 0,
            precioPublico: p.precio_publico ?? 0,
            precioComercio: p.precio_comercio ?? 0,
            precioMayorista: p.precio_mayorista ?? 0,
        }));
        
        console.log(`[${SERVICE_NAME}] Successfully fetched ${simpleProductos.length} simple products.`);
        return simpleProductos;

    } catch(error: any) {
        console.error(`[${SERVICE_NAME}] Error fetching simple products:`, error.message);
        throw error;
    }
}

const uploadImage = async (imageFile: File): Promise<string> => {
    const fileExt = imageFile.name.split('.').pop();
    const fileName = `${Date.now()}.${fileExt}`;
    const filePath = `public/${fileName}`;
    
    console.log(`[${SERVICE_NAME}] Uploading image to path: ${filePath}`);
    
    const { error: uploadError } = await supabase.storage
        .from('PRODUCTOS')
        .upload(filePath, imageFile);

    if (uploadError) {
        console.error(`[${SERVICE_NAME}] Image upload failed:`, uploadError);
        throw new Error(`Error al subir la imagen: ${uploadError.message}`);
    }

    const { data: urlData } = supabase.storage
        .from('PRODUCTOS')
        .getPublicUrl(filePath);
    
    console.log(`[${SERVICE_NAME}] Image uploaded successfully. Public URL: ${urlData.publicUrl}`);
    return urlData.publicUrl;
};


export const createProducto = async (
    productoData: Partial<Producto>,
    imageFile: File | null
): Promise<Producto> => {
    console.log(`[${SERVICE_NAME}] Attempting to create new product: ${productoData.nombre}`);
    let imageUrl: string | null = null;

    if (imageFile) {
        imageUrl = await uploadImage(imageFile);
    }

    const newProductData = {
        nombre: productoData.nombre,
        codigo_barras: productoData.codigoBarras || null,
        precio_publico: productoData.precioPublico,
        precio_comercio: productoData.precioComercio,
        precio_mayorista: productoData.precioMayorista,
        descripcion: productoData.descripcion || null,
        imagen_url: imageUrl,
        linea: productoData.linea || 'General',
        box_length_cm: productoData.boxLengthCm,
        box_width_cm: productoData.boxWidthCm,
        box_height_cm: productoData.boxHeightCm,
        product_weight_kg: productoData.productWeightKg,
        products_per_box: productoData.productsPerBox,
    };
    
    console.log(`[${SERVICE_NAME}] Inserting new product into database.`);
    const { data: insertedData, error: insertError } = await supabase
        .from('productos')
        .insert([newProductData] as any)
        .select()
        .single();

    if (insertError) {
        console.error(`[${SERVICE_NAME}] Database insert failed:`, insertError.message);
        throw new Error(`Error al guardar en la base de datos: ${insertError.message}`);
    }
    
    console.log(`[${SERVICE_NAME}] Product created successfully with ID: ${insertedData.id}`);

    // The returned product from the insert won't have the calculated stock or lots
    // So we fetch it again to ensure the UI gets the complete, fresh object.
    const allProducts = await fetchProductosConStock();
    const newProduct = allProducts.find(p => p.id === insertedData.id);
    return newProduct!;
};

export const updateProducto = async (
    productoId: string,
    productoData: Partial<Producto>,
    imageFile: File | null
): Promise<Producto> => {
    console.log(`[${SERVICE_NAME}] Attempting to update product ID: ${productoId}`);
    
    const { data: currentProduct, error: fetchError } = await (supabase
        .from('productos') as any)
        .select('imagen_url')
        .eq('id', productoId)
        .single();
    
    if (fetchError) {
        console.error(`[${SERVICE_NAME}] Failed to fetch current product for update:`, fetchError);
        throw new Error(`No se pudo obtener el producto actual: ${fetchError.message}`);
    }

    let imageUrl: string | null = currentProduct.imagen_url;

    if (imageFile) {
        // If there's an old image, delete it from storage
        if (currentProduct.imagen_url) {
            const oldImageName = currentProduct.imagen_url.split('/').pop();
            if (oldImageName) {
                console.log(`[${SERVICE_NAME}] Deleting old image: public/${oldImageName}`);
                await supabase.storage.from('PRODUCTOS').remove([`public/${oldImageName}`]);
            }
        }
        // Upload the new image
        imageUrl = await uploadImage(imageFile);
    }

    const updatedProductData = {
        nombre: productoData.nombre,
        codigo_barras: productoData.codigoBarras || null,
        precio_publico: productoData.precioPublico,
        precio_comercio: productoData.precioComercio,
        precio_mayorista: productoData.precioMayorista,
        descripcion: productoData.descripcion || null,
        imagen_url: imageUrl,
        linea: productoData.linea,
        box_length_cm: productoData.boxLengthCm,
        box_width_cm: productoData.boxWidthCm,
        box_height_cm: productoData.boxHeightCm,
        product_weight_kg: productoData.productWeightKg,
        products_per_box: productoData.productsPerBox,
    };
    
    console.log(`[${SERVICE_NAME}] Updating product in database.`);
    const { data: updatedData, error: updateError } = await (supabase
        .from('productos') as any)
        .update(updatedProductData as any)
        .eq('id', productoId)
        .select()
        .single();

    if (updateError) {
        console.error(`[${SERVICE_NAME}] Database update failed:`, updateError.message);
        throw new Error(`Error al actualizar en la base de datos: ${updateError.message}`);
    }

    console.log(`[${SERVICE_NAME}] Product updated successfully.`);
    
    // We need to fetch the full product details again to return it in the correct shape
    const fullProduct = await fetchProductosConStock();
    return fullProduct.find(p => p.id === updatedData.id)!;
};

export const deleteProducto = async (productoId: string): Promise<void> => {
    console.log(`[${SERVICE_NAME}] Attempting to delete product ID: ${productoId}`);

    // First, get the image URL to delete it from storage.
    // Using `any` here is a targeted workaround for a known Supabase/TypeScript issue ("Type instantiation is excessively deep")
    // that can occur with complex schemas. It avoids errors during TypeScript compilation without affecting runtime.
    const { data, error: fetchError } = await (supabase
        .from('productos') as any)
        .select('imagen_url')
        .eq('id', productoId)
        .single();

    if (fetchError) {
        console.error(`[${SERVICE_NAME}] Failed to fetch product for deletion:`, fetchError);
        throw new Error(`No se pudo obtener el producto para eliminarlo: ${fetchError.message}`);
    }

    // Delete the image from storage if it exists
    if (data?.imagen_url) {
        const imageName = data.imagen_url.split('/').pop();
        if (imageName) {
            console.log(`[${SERVICE_NAME}] Deleting image from storage: public/${imageName}`);
            const { error: storageError } = await supabase.storage.from('PRODUCTOS').remove([`public/${imageName}`]);
            if (storageError) {
                console.warn(`[${SERVICE_NAME}] Could not delete image from storage, but proceeding with DB deletion:`, storageError.message);
            }
        }
    }

    // Then, delete the product record from the database
    const { error: deleteError } = await (supabase
        .from('productos') as any)
        .delete()
        .eq('id', productoId);

    if (deleteError) {
        console.error(`[${SERVICE_NAME}] Database delete failed:`, deleteError.message);
        throw new Error(`Error al eliminar el producto de la base de datos: ${deleteError.message}`);
    }

    console.log(`[${SERVICE_NAME}] Product deleted successfully.`);
};