export function FacturasModule({ currentUserRole }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true); // Añadimos estado de carga
  const { activeSocietyId } = useSociety();

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      const { data, error } = await supabase
        .from('facturas')
        .select('*, empleados(nombre), centros(nombre)')
        .eq('centros.id_sociedad', activeSocietyId);
      
      if (!error) setData(data || []);
      setLoading(false);
    }
    
    if (activeSocietyId) fetchData();
  }, [activeSocietyId]);

  // Aquí está el cambio: ahora sí pintamos algo
  if (loading) return <div>Cargando facturas...</div>;
  if (data.length === 0) return <div>No se encontraron facturas para esta sociedad.</div>;

  return (
    <div style={{ padding: '20px' }}>
      <h2>Listado de Facturas</h2>
      <ul>
        {data.map((factura) => (
          <li key={factura.id}>
            Factura ID: {factura.id} - Centro: {factura.centros?.nombre}
          </li>
        ))}
      </ul>
    </div>
  );
}