import axios from 'axios';
import { serverOrigin } from './requests';

axios.defaults.baseURL = serverOrigin;
axios.defaults.timeout = 10_000;
axios.defaults.withCredentials = true;
