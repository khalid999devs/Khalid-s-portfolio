import axios from 'axios';
import { serverOrigin } from './requests';

axios.defaults.baseURL = serverOrigin;

/**
 * Send the session cookie on every request.
 *
 * Every call in this application goes to our own API, so there is no third
 * party to leak a cookie to, and the server only reflects credentials back to
 * origins on its allowlist.
 *
 * This is a default rather than a per call option because the per call version
 * failed exactly the way you would expect: the resume upload omitted it, the
 * cookie never went, and the panel reported "admin not logged in" to somebody
 * who was very much logged in. Every other call on the page worked, which made
 * it look like a session problem rather than a missing option.
 */
axios.defaults.withCredentials = true;
