import { supabase } from '../supabase';

const SERVICE_NAME = 'AjustesService';

export interface Umbrales {
    comercio: number;
    mayorista: number;
}

export interface Cotizaciones {
    usd: number;
    brl: number;
}

export const fetchUmbrales = async (): Promise<Umbrales> => {
    console.log(`[${SERVICE_NAME}] Fetching price thresholds.`);
    try {
        const { data, error } = await supabase
            .from('ajustes_sistema')
            .select('clave, valor')
            .in('clave', ['UMBRAL_COMERCIO', 'UMBRAL_MAYORISTA']);

        if (error) throw error;
        
        const umbrales: Umbrales = { comercio: 0, mayorista: 0 };
        if (data) {
            for (const row of data) {
                if (row.clave === 'UMBRAL_COMERCIO') {
                    umbrales.comercio = Number(row.valor) || 0;
                } else if (row.clave === 'UMBRAL_MAYORISTA') {
                    umbrales.mayorista = Number(row.valor) || 0;
                }
            }
        }
        return umbrales;
    } catch (error: any) {
        console.error(`[${SERVICE_NAME}] Error fetching thresholds:`, error);
        throw error;
    }
};

export const saveUmbrales = async (umbrales: Umbrales): Promise<void> => {
    try {
        const dataToUpsert = [
            { clave: 'UMBRAL_COMERCIO', valor: umbrales.comercio },
            { clave: 'UMBRAL_MAYORISTA', valor: umbrales.mayorista },
        ];
        const { error } = await supabase.from('ajustes_sistema').upsert(dataToUpsert);
        if (error) throw error;
    } catch (error: any) {
        throw new Error(`No se pudieron guardar los ajustes: ${error?.message}`);
    }
};

export const fetchCotizaciones = async (): Promise<Cotizaciones> => {
    console.log(`[${SERVICE_NAME}] Fetching COMEX exchange rates.`);
    try {
        const { data, error } = await supabase
            .from('ajustes_sistema')
            .select('clave, valor')
            .in('clave', ['COTIZACION_USD', 'COTIZACION_BRL']);

        if (error) throw error;
        
        const rates: Cotizaciones = { usd: 1000, brl: 180 }; // Defaults
        if (data) {
            for (const row of data) {
                if (row.clave === 'COTIZACION_USD') {
                    rates.usd = Number(row.valor) || 1000;
                } else if (row.clave === 'COTIZACION_BRL') {
                    rates.brl = Number(row.valor) || 180;
                }
            }
        }
        return rates;
    } catch (error: any) {
        console.error(`[${SERVICE_NAME}] Error fetching rates:`, error);
        return { usd: 1000, brl: 180 };
    }
};

export const saveCotizaciones = async (rates: Cotizaciones): Promise<void> => {
    try {
        const dataToUpsert = [
            { clave: 'COTIZACION_USD', valor: rates.usd },
            { clave: 'COTIZACION_BRL', valor: rates.brl },
        ];
        const { error } = await supabase.from('ajustes_sistema').upsert(dataToUpsert);
        if (error) throw error;
    } catch (error: any) {
        throw new Error(`No se pudieron guardar las cotizaciones: ${error?.message}`);
    }
};