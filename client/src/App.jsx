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
  const [resumeAvailable, setResumeAvailable] = useState(false);
  const [appData, setAppData] = useState({ projects: [] });
  const [loadAttempt, setLoadAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const requestConfig = {
      signal: controller.signal,
      timeout: 10000,
    };
    let isMounted = true;

    setLoading(true);
    setDataError(null);

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
        setResumeAvailable(
          settingsResult.value.data.resumeAvailable === true
        );
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
  }, [loadAttempt]);

  const contextValue = useMemo(
    () => ({
      loading,
      dataError,
      settings,
      setSettings,
      resumeAvailable,
      appData,
    }),
    [loading, dataError, settings, resumeAvailable, appData]
  );

  return (
    <LenisGSAP>
      <AppContext.Provider value={contextValue}>
        <div className='bg-body-main min-h-screen w-full'>
          <MetaCard />
          <div className='sr-only' role='status' aria-live='polite'>
            {loading ? 'Loading portfolio data.' : ''}
          </div>
          {dataError && !loading && (
            <div
              className='pointer-events-auto fixed left-1/2 top-20 z-[60] flex w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 items-center justify-between gap-4 rounded-xl border border-red-400/40 bg-red-950/95 px-4 py-3 text-sm text-primary-main shadow-xl backdrop-blur-md'
              role='alert'
            >
              <span>{dataError} You can retry without leaving this page.</span>
              <button
                type='button'
                className='shrink-0 rounded-lg border border-primary-main/60 px-3 py-1.5 font-medium transition-colors hover:bg-primary-main hover:text-body-main'
                onClick={() => setLoadAttempt((attempt) => attempt + 1)}
              >
                Retry
              </button>
            </div>
          )}
          <MouseMoveEffect />
          <Navbar resumeAvailable={resumeAvailable} />
          <main className='pointer-none'>
            <AnimatedOutlet />
          </main>
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
