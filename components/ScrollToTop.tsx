import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const ScrollToTop = () => {
    const { pathname, hash } = useLocation();

    useEffect(() => {
        // If there is a hash, we let the hash handling logic (in Navbar or elsewhere) take over
        // Otherwise, simply scroll to top instantly
        if (!hash) {
            window.scrollTo(0, 0);
        } else {
            // If there is a hash, and we are on a new page load, we might want to ensure we jump there.
            // But usually hash links handled by browser or custom logic.
            // The user requested: "If in different page then homepage = immediatly transfer there" (for #how-it-works)
            // This is "transfer to homepage". The browser usually handles layout shifts.
            // We'll prioritize the top scroll for non-hash routes.
            // For hash routes, we might need to wait for render.
        }
    }, [pathname, hash]);

    return null;
};

export default ScrollToTop;
