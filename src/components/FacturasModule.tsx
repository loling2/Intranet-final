
import React, { useState, useEffect } from 'react';
import { useSociety } from '../context/SocietyContext';
import { supabase } from '../supabaseClient';

export function FacturasModule({ currentUserRole }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true); // Añadimos estado de carga
  const { activeSocietyId } = useSociety();

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      // Quitamos el .eq para ver TODO lo que hay en la tabla
      const { data, error } = await supabase
        .from('facturas')
        .select('*, empleados(nombre), centros(nombre)');
      
      if (error) console.error("Error Supabase:", error);
      else {
        console.log("Datos recibidos desde Supabase:", data); // Mira esto en F12
        setData(data || []);
      }
      setLoading(false);
    }
    
    fetchData(); // Quitamos el if(activeSocietyId) temporalmente
  }, []); // Array vacío para que solo se ejecute al cargar

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