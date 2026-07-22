import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import Navbar from './components/Navs/Navbar';
import Footer from './components/Footer/Footer';
import { reqs } from './axios/requests';
import MouseMoveEffect from './animations/MouseMoveEffect';
import AnimatedOutlet from './animations/AnimatedOutlet';
import { LenisGSAP } from './animations/LenisGSAP';
import MetaCard from './components/utils/MetaCard';

const AppContext = createContext({});

const App = () => {
  const [loading, setLoading] = useState(true);
  const [dataError, setDataError] = useState(null);
  const [settings, setSettings] = useState({});
  const [appData, setAppData] = useState({ projects: [] });

  useEffect(() => {
    const controller = new AbortController();
    const requestConfig = {
      signal: controller.signal,
      timeout: 10000,
    };
    let isMounted = true;

    const fetchData = async () => {
      const [settingsResult, projectsResult] = await Promise.allSettled([
        axios.get(reqs.GET_SETTINGS, requestConfig),
        axios.post(reqs.GET_PROJECT, { mode: 'all' }, requestConfig),
      ]);

      if (!isMounted || controller.signal.aborted) return;

      const failedRequests = [];

      if (
        settingsResult.status === 'fulfilled' &&
        settingsResult.value.data?.succeed
      ) {
        setSettings(settingsResult.value.data.result || {});
      } else {
        failedRequests.push('settings');
      }

      if (
        projectsResult.status === 'fulfilled' &&
        projectsResult.value.data?.succeed &&
        Array.isArray(projectsResult.value.data.result)
      ) {
        setAppData({ projects: projectsResult.value.data.result });
      } else {
        failedRequests.push('projects');
      }

      if (failedRequests.length > 0) {
        setDataError(`Unable to load ${failedRequests.join(' and ')}.`);
      }

      setLoading(false);
    };

    fetchData().catch(() => {
      if (!isMounted || controller.signal.aborted) return;

      setDataError('Unable to load portfolio data.');
      setLoading(false);
    });

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, []);

  const contextValue = useMemo(
    () => ({
      loading,
      dataError,
      settings,
      setSettings,
      appData,
    }),
    [loading, dataError, settings, appData]
  );

  return (
    <LenisGSAP>
      <AppContext.Provider value={contextValue}>
        <div className='bg-body-main min-h-screen w-full'>
          <MetaCard />
          <div className='sr-only' role='status' aria-live='polite'>
            {loading ? 'Loading portfolio data.' : ''}
          </div>
          {dataError && (
            <div className='sr-only' role='alert'>
              {dataError}
            </div>
          )}
          <MouseMoveEffect />
          <Navbar />
          <div className='pointer-none'>
            <AnimatedOutlet />
          </div>
          <Footer />
        </div>
      </AppContext.Provider>
    </LenisGSAP>
  );
};

export default App;
// Exporting context hook alongside component is acceptable
// eslint-disable-next-line react-refresh/only-export-components
export const useAppContext = () => useContext(AppContext);
