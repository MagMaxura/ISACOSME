
const SUPABASE_URL = 'https://qlsyymuldzoyiazyzxlf.supabase.co';

export interface OcaBranch {
    id: string;
    name: string;
    address: string;
    city: string;
}

/**
 * Obtiene las sucursales de OCA para un Código Postal dado
 */
export async function getBranchesByCP(cp: string): Promise<OcaBranch[]> {
    if (!cp || cp.length < 3) return [];
    
    try {
        const response = await fetch(`${SUPABASE_URL}/functions/v1/oca_webhook?cp=${cp}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error('Error al consultar sucursales de OCA');
        }
        
        return await response.json();
    } catch (error) {
        console.error('Error in getBranchesByCP:', error);
        return [];
    }
}
