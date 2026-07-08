import { useLocation } from 'react-router-dom';
import { buildMeta } from '../utils/seo';

const useSeoMeta = (title, description) => {
  const location = useLocation();
  return buildMeta({
    title,
    description,
    pathname: location.pathname
  });
};

export default useSeoMeta;
