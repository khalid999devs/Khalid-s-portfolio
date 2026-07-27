import { useEffect, useState } from 'react';
import axios from 'axios';
import { reqs } from '../axios/requests';
import {
  achievements as fallbackAchievements,
  education as fallbackEducation,
  experience as fallbackExperience,
} from '../Constants';

/**
 * Employment, education and achievements, from the API.
 *
 * These used to be hardcoded arrays in `Constants`, so adding a job meant
 * editing source and redeploying. They are rows now, editable from the admin
 * panel.
 *
 * The API returns a neutral shape (`title`, `subtitle`, `period`, `link`) and
 * this maps it back to the field names the About page already renders, rather
 * than rewriting the page. The markup is untouched, only where the data comes
 * from changed.
 *
 * The Constants arrays stay as the fallback. If the API is unreachable the
 * About page still renders the same content it always did instead of showing
 * three empty sections, which is the failure mode that would actually be
 * noticed by a visitor.
 */
export const useAboutEntries = () => {
  const [entries, setEntries] = useState({
    experience: fallbackExperience,
    achievements: fallbackAchievements,
    education: fallbackEducation,
  });

  useEffect(() => {
    let cancelled = false;

    axios
      .get(reqs.GET_ABOUT)
      .then((res) => {
        if (cancelled || !res.data?.succeed) return;
        const { experience = [], education = [], achievement = [] } = res.data.result ?? {};

        // An empty table would blank the page. Falling back per section means a
        // half-populated database still shows whatever it does have.
        setEntries({
          experience: experience.length
            ? experience.map((item) => ({
                company: item.title,
                designation: item.subtitle,
                date: item.period,
                link: item.link,
              }))
            : fallbackExperience,

          achievements: achievement.length
            ? achievement.map((item) => ({
                title: item.title,
                from: item.subtitle,
                date: item.period,
                link: item.link,
              }))
            : fallbackAchievements,

          education: education.length
            ? education.map((item) => ({
                degree: item.title,
                institute: item.subtitle,
                date: item.period,
              }))
            : fallbackEducation,
        });
      })
      .catch(() => {
        // Keep the fallback. The About page is not the place to surface an API
        // outage to a visitor.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return entries;
};
