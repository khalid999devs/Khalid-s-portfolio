import { FiGithub } from 'react-icons/fi';
import { RiLinkedinLine } from 'react-icons/ri';
import { BsYoutube } from 'react-icons/bs';
import { RiTwitterXFill } from 'react-icons/ri';
import { MdSpaceDashboard } from 'react-icons/md';
import { MdOutlineLaptopMac } from 'react-icons/md';
import { MdOutlineAddToQueue } from 'react-icons/md';
import { MdSettings } from 'react-icons/md';

export const pageNavLinks = [
  {
    title: 'Home',
    path: '/',
  },
  {
    title: 'Projects',
    path: '/projects',
  },
  {
    title: 'About',
    path: '/about-me',
  },
  // {
  //   title: 'Coding Lab',
  //   path: 'coding-lab',
  // },
];

export const adminNavLinks = [
  {
    title: 'Dashboard',
    path: '',
    icon: MdSpaceDashboard,
  },
  {
    title: 'Projects',
    path: 'projects',
    icon: MdOutlineLaptopMac,
  },
  {
    title: 'Add Project',
    path: 'add-project',
    icon: MdOutlineAddToQueue,
  },
  {
    title: 'Settings',
    path: 'settings',
    icon: MdSettings,
  },
];

export const socialLinks = [
  {
    title: 'Github',
    icon: FiGithub,
    path: 'https://github.com/khalid999devs',
  },
  {
    title: 'LinkedIn',
    icon: RiLinkedinLine,
    path: 'https://www.linkedin.com/in/khalid-ahammed',
  },
  {
    title: 'X',
    icon: RiTwitterXFill,
    path: 'https://x.com/khalid999devs',
  },
  {
    title: 'YouTube',
    icon: BsYoutube,
    path: 'https://www.youtube.com/@khalid999devs',
  },
];

export const upworkedSocialLinks = [
  {
    title: 'Github',
    icon: FiGithub,
    path: 'https://github.com/khalid999devs',
  },
];

export const workingFields = `Website Development—Web Application & Software Development—UI/UX—Mobile App Development`;

export const experience = [
  {
    company: 'DevGenit',
    designation: 'Chief Operating Officer',
    date: '2023 — Present',
    link: 'https://www.devgenit.com',
  },
  {
    company: 'Notre Dame Information Technology Club',
    designation: 'President, Department of Web & App Development',
    date: '2021 — 2022',
    link: 'https://nditc.net',
  },
];

export const achievements = [
  {
    title: 'Regional Winner and Global Nominee',
    from: 'NASA SPACE APP CHALLANGE HACKATHON 2024',
    date: '2024',
    link: 'https://www.spaceappschallenge.org/nasa-space-apps-2024/find-a-team/novaflare/?tab=details',
  },
  {
    title: 'Champion in national Web Design Contest',
    from: 'Notre Dame Science Club',
    date: '2022',
    link: 'https://www.facebook.com/photo/?fbid=5025775960821528&set=pcb.1113307382606258',
  },
];

export const education = [
  {
    degree: 'Computer Science and Engineering',
    institute: 'Khulna University of Engineering & Technology, Bangladesh.',
    date: '2023 — 2027',
  },
  {
    degree: 'Higher Secondary School Certificate ',
    institute: 'Notre Dame College, Dhaka, Bangladesh',
    date: '2020 — 2022',
  },
];
