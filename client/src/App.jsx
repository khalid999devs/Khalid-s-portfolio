import { createContext, useContext, useEffect, useState, useRef } from 'react';
import PropTypes from 'prop-types';
import axios from 'axios';
import gsap from 'gsap';
import CustomEase from 'gsap/CustomEase';
import Navbar from './components/Navs/Navbar';
import Footer from './components/Footer/Footer';
import { reqs } from './axios/requests';
import MouseMoveEffect from './animations/MouseMoveEffect';
import { useVisitTracking } from './hooks/useVisitTracking';
import AnimatedOutlet from './animations/AnimatedOutlet';
import { LenisGSAP } from './animations/LenisGSAP';

gsap.registerPlugin(CustomEase);
const customEase = CustomEase.create('custom', '.87,0,.13,1');

const AppContext = createContext({});

const PageLoader = ({ progress, onComplete }) => {
  useEffect(() => {
    gsap.to('.progress-bar', {
      width: `${progress}vw`,
      duration: 2,
      ease: customEase,
      onComplete: () => {
        if (progress >= 100) {
          setTimeout(() => {
            gsap.to('.progress-bar', {
              opacity: 0,
              duration: 0.5,
              onComplete: onComplete,
            });
          }, 200);
        }
      },
    });
    gsap.to('#counter', {
      innerHTML: progress,
      duration: 2,
      ease: customEase,
      snap: { innerHTML: 1 },
    });
  }, [progress, onComplete]);

  return (
    <div className='loader-container bg-onPrimary-main relative w-screen h-screen z-50'>
      <div className='progress-bar absolute top-1/2 left-0 -tanslate-y-1/2 w-[25vw] p-[2em] flex justify-end md:justify-between items-center text-primary-main bg-body-main'>
        <p className='relative uppercase antialiased grayscale hidden md:inline '>
          loading
        </p>
        <p className='relative uppercase antialiased grayscale'>
          <span id='counter'>0</span>
        </p>
      </div>
    </div>
  );
};

PageLoader.propTypes = {
  progress: PropTypes.number.isRequired,
  onComplete: PropTypes.func.isRequired,
};

const App = () => {
  // Anonymous page view counting. Fire and forget, and skipped for /admin.
  useVisitTracking();
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [settings, setSettings] = useState({});
  const [appData, setAppData] = useState({ projects: [] });
  const progressRef = useRef(0);
  const [minLoaderTime] = useState(3000);

  const updateProgress = (newProgress) => {
    if (progressRef.current !== newProgress) {
      setProgress(newProgress);
      progressRef.current = newProgress;
    }
  };

  useEffect(() => {
    const onResourceLoad = async () => {
      await document.fonts.ready;
      updateProgress(100);
    };

    const fetchData = async () => {
      try {
        const settingsReq = axios.get(reqs.GET_SETTINGS, {
          onDownloadProgress: (progressEvent) => {
            const percentage = Math.round(
              (progressEvent.loaded * 100) / progressEvent.total
            );
            updateProgress(Math.min(percentage, 99));
          },
        });

        const projectsReq = axios.post(
          reqs.GET_PROJECT,
          { mode: 'all' },
          {
            onDownloadProgress: (progressEvent) => {
              const percentage = Math.round(
                (progressEvent.loaded * 100) / progressEvent.total
              );
              updateProgress(Math.min(percentage, 99));
            },
          }
        );

        const [settingsRes, projectsRes] = await Promise.all([
          settingsReq,
          projectsReq,
        ]);

        if (settingsRes.data.succeed) setSettings(settingsRes.data.result);
        if (projectsRes.data.succeed)
          setAppData({ projects: projectsRes.data.result });
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        updateProgress(100);
      }
    };

    if (document.readyState === 'complete') {
      fetchData();
      onResourceLoad();
    } else {
      window.addEventListener('load', onResourceLoad);
      fetchData();
    }

    const loaderTimeout = setTimeout(() => {
      setLoading(false);
    }, minLoaderTime);

    return () => {
      window.removeEventListener('load', onResourceLoad);
      clearTimeout(loaderTimeout);
    };
  }, [minLoaderTime]);

  if (loading)
    return (
      <PageLoader progress={progress} onComplete={() => setLoading(false)} />
    );

  return (
    <LenisGSAP>
      <AppContext.Provider value={{ loading, settings, setSettings, appData }}>
        <div className='bg-body-main min-h-screen w-full'>
          {/*
            MetaCard used to render here as a site-wide default, with pages
            rendering a second one to override the title. Helmet 2 merged the
            two instances and emitted a single set of tags, deepest value
            winning, so the duplication was invisible.

            React 19 hoists metadata itself and does not merge or de-duplicate,
            and react-helmet-async 3 hands over to it -- so both instances
            emitted, and /projects and /about-me went from 22 head tags to 32,
            with two conflicting og:title values. Each route now renders exactly
            one MetaCard instead.
          */}
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
