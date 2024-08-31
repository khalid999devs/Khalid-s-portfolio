import axios from 'axios';
import { serverOrigin } from './requests';

axios.defaults.baseURL = serverOrigin;
