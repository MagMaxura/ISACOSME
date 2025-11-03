// FIX: Use `import type` for type-only imports and remove `AuthResponse` which is not an exported member of `@supabase/supabase-js`.
import type { Session, User, AuthError } from '@supabase/supabase-js';

export type AppRole = 'superadmin' | 'vendedor' | 'administrativo' | 'analitico' | 'cliente' | 'comex' | 'comex_pending';
export type PuntoDeVenta = 'Mercado Libre' | 'Tienda física' | 'Redes Sociales';

export interface Profile {
  id: string;
  email: string;
  roles: AppRole[];
}

export interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  error: any | null; // Changed to 'any' to hold the full error object
  login: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signup: (email: string, password: string, role?: AppRole, metadata?: object) => Promise<{ error: any | null }>;
  logout: () => Promise<{ error: AuthError | null }>;
  retryProfileFetch: () => void;
}

export type InsumoCategoria = 'VALVULA' | 'ETIQUETA' | 'CAJA' | 'MATERIAL ESPECIAL' | 'ENVASE' | 'OTRO';
export type InsumoUnidad = 'unidades' | 'gramos' | 'ml';


export interface Insumo {
  id: string;
  nombre: string;
  stock: number;
  unidad: InsumoUnidad;
  costo: number;
  proveedor?: string | null;
  categoria?: InsumoCategoria | null;
  ultima_compra?: string | null;
  ultimo_lote_pedido?: string | null;
}

export interface ProductoInsumo {
  insumoId: string;
  cantidad: number;
  insumoNombre?: string;
}

export interface Lote {
    id: string;
    numero_lote: string;
    cantidad_inicial: number;
    cantidad_actual: number;
    fecha_vencimiento: string | null;
    costo_laboratorio: number;
    deposito_id: string;
    depositoNombre?: string;
}

export interface StockPorDeposito {
    depositoId: string;
    depositoNombre: string;
    stock: number;
    lotes: Lote[];
}

export interface GaleriaImagen {
  id: string;
  url: string;
}

export interface Producto {
  id: string;
  codigoBarras: string | null;
  nombre: string;
  descripcion: string | null;
  precioPublico: number;
  precioComercio: number;
  precioMayorista: number;
  imagenUrl: string | null;
  costoInsumos: number;
  linea: string | null;
  cantidadMinimaComercio?: number | null;
  cantidadMinimaMayorista?: number | null;
  // COMEX fields
  boxLengthCm?: number | null;
  boxWidthCm?: number | null;
  boxHeightCm?: number | null;
  productWeightKg?: number | null;
  productsPerBox?: number | null;
  // Calculated/Joined fields for UI
  stock: number; // Renamed to stockTotal for clarity
  stockTotal: number;
  lotes: Lote[]; // All lots for the product
  stockPorDeposito: StockPorDeposito[]; // Detailed stock breakdown
  insumos: ProductoInsumo[];
  imagenesGaleria: GaleriaImagen[];
}

// A simplified version for selections
export type SimpleProducto = Pick<Producto, 'id' | 'nombre' | 'precioPublico' | 'precioComercio' | 'precioMayorista' | 'stockTotal'> & { codigoBarras?: string | null };
export type SimpleCliente = Pick<Cliente, 'id' | 'nombre' | 'telefono' | 'email' | 'listaPrecioNombre' | 'direccion' | 'localidad' | 'provincia'>;


export interface Cliente {
  id: string;
  nombre: string; // Nombre del Comercio
  representante: string | null;
  provincia: string | null;
  localidad: string | null;
  codigoPostal: string | null;
  rubro: string | null;
  telefono: string | null;
  direccion: string | null;
  redSocial: string | null;
  cuit: string | null;
  email: string | null;
  descripcion: string | null;
  listaPrecioId: string | null;
  listaEnviada: boolean;
  fechaEnvioLista: string | null;
  tieneStock: boolean;
  fechaRegistro: string;
  // Joined field for display
  listaPrecioNombre?: string;
  // FIX: Add total purchased amount to fix type errors in Clientes.tsx.
  totalComprado?: number;
}

export interface VentaItem {
  productoId: string;
  cantidad: number;
  precioUnitario: number;
  productoNombre?: string;
}

export interface Venta {
  id: string;
  clienteId: string | null;
  fecha: string;
  items: VentaItem[];
  subtotal: number;
  iva: number;
  total: number;
  tipo: 'Venta' | 'Consignacion';
  estado: 'Pendiente' | 'Pagada' | 'Enviada' | 'Cancelada';
  puntoDeVenta?: PuntoDeVenta | null;
  costoTotal?: number;
  tipoDeCambio?: number;
  pago1?: number;
  clienteNombre?: string;
  observaciones?: string | null;
}

export interface ListaPrecioItem {
  productoId: string;
  productoNombre: string;
  precio: number;
  linea: string | null;
}

export interface ListaPrecio {
  id: string;
  nombre: string;
  productos: ListaPrecioItem[];
}

// A lightweight version for the list of price lists
export interface ListMeta {
  id: string;
  nombre: string;
}

// Type for the price list management page
export interface ProductoConPrecio {
  id: string;
  nombre:string;
  linea: string | null;
  precioPublico: number;
  precioAsignado: number;
}

// Types for Dashboard stock alerts
export interface LowStockProducto {
  id: string;
  nombre: string;
  stock: number;
}

export interface LowStockInsumo {
  id: string;
  nombre: string;
  stock: number;
  unidad: InsumoUnidad;
}

export interface DashboardStats {
  totalSales: number;
  totalRevenue: number;
  totalProductStock: number;
  totalInsumosCount: number;
  lowStockProducts: LowStockProducto[];
  lowStockInsumos: LowStockInsumo[];
}

// Types for Product Dashboard
// FIX: Add 'unidad' property to match data from the service and fix UI errors.
export interface InsumoConCosto {
    id: string;
    nombre: string;
    cantidad_necesaria: number;
    costo_total_insumo: number;
    unidad: InsumoUnidad;
}

// FIX: Update DashboardData to match the new, more detailed data structure from the service.
// This fixes errors related to missing properties like 'costoLaboratorioReciente', 'totalIngresosProducto', etc.
export interface DashboardData {
    producto: Producto;
    costoInsumos: number;
    costoLaboratorioReciente: number;
    costoTotal: number;
    gananciaNeta: number;
    margenGanancia: number;
    unidadesVendidas: number;
    totalIngresosProducto: number;
    stockTotalActual: number;
    ultimaVentaFecha: string | null;
    precioPromedioVenta: number;
    insumosDetalle: InsumoConCosto[];
    stockPorDeposito: StockPorDeposito[];
    ventasPorDia: { [date: string]: number };
    ventasPorMes: { [month: string]: number };
    ventasPorAnio: { [year: string]: number };
}

// Types for Multi-Location Inventory
export interface Deposito {
    id: string;
    nombre: string;
    direccion: string | null;
    es_predeterminado: boolean;
}

export interface TransferenciaStock {
    id: string;
    fecha: string;
    productoNombre: string;
    depositoOrigenNombre: string;
    depositoDestinoNombre: string;
    cantidad: number;
    usuarioEmail: string;
    notas: string | null;
    // FIX: Add numeroLote to fix type errors in TransferenciasStock.tsx.
    numeroLote?: string | null;
}

// Type for COMEX access requests
export interface AccessRequest {
    id: string;
    created_at: string;
    company_name: string;
    contact_person: string;
    email: string;
    country: string;
    message: string | null;
    status: 'pending' | 'approved' | 'rejected';
}

// Types for Product Statistics Page
export interface ProductoEstadistica {
  id: string;
  nombre: string;
  ventasMesActual: number;
  ventasAñoActual: number;
  costoTotalUnitario: number;
  precioPublico: number;
  precioComercio: number;
  precioMayorista: number;
  stockTotal: number;
  tasaRotacion: number;
  tasaVentasPromedio: number;
}