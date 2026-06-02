// Dentro de FacturasModule.tsx
export function FacturasModule({ currentUserRole }) {
  const [data, setData] = useState([]);
  const { activeSocietyId } = useSociety();

  useEffect(() => {
    async function fetchData() {
      const { data, error } = await supabase
        .from('facturas')
        .select('*, empleados(nombre), centros(nombre)')
        .eq('centros.id_sociedad', activeSocietyId);
      
      if (!error) setData(data);
    }
    
    if (activeSocietyId) fetchData();
  }, [activeSocietyId]);

  return <div>{/* Tu renderizado aquí */}</div>;
}