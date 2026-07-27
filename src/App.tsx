import { useEffect, useState } from 'react';
import LoginPage from './LoginPage';
import KioscoFichaje from './KioscoFichaje';

function getRoute(): string {
  const hash = window.location.hash.slice(1);
  if (hash) return hash;
  return window.location.pathname;
}

function App() {
  const [route, setRoute] = useState(getRoute);

  useEffect(() => {
    const onChange = () => setRoute(getRoute());
    window.addEventListener('hashchange', onChange);
    window.addEventListener('popstate', onChange);
    return () => {
      window.removeEventListener('hashchange', onChange);
      window.removeEventListener('popstate', onChange);
    };
  }, []);

  if (route === '/kiosco' || route === 'kiosco' || route.endsWith('/kiosco')) {
    return <KioscoFichaje />;
  }

  return <LoginPage />;
}

export default App;
