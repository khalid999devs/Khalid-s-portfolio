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
    path: 'projects',
  },
  {
    title: 'About',
    path: 'about',
  },
  {
    title: 'Coding Lab',
    path: 'coding-lab',
  },
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
