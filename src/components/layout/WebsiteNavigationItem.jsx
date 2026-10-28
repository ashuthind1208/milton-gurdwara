import { useId, useRef, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { ChevronDownIcon } from '@heroicons/react/24/outline';

const MenuLink = ({ item, children, ...props }) => /^https?:\/\//i.test(item.path)
  ? <a href={item.path} {...props} className={typeof props.className === 'function' ? props.className({ isActive: false }) : props.className}>{children}</a>
  : <NavLink to={item.path} end={item.path === '/'} {...props}>{children}</NavLink>;

const WebsiteNavigationItem = ({ item, linkClass, onNavigate, mobile = false, alignEnd = false }) => {
  const [expanded, setExpanded] = useState(false);
  const triggerRef = useRef(null);
  const instanceId = useId();
  const children = item.children || [];
  const menuId = `website-menu-${instanceId}`;
  const close = (event) => { setExpanded(false); onNavigate?.(event); };
  return (
    <div className={mobile ? 'w-full' : 'relative min-w-0'}
      onMouseEnter={() => { if (!mobile) setExpanded(true); }}
      onMouseLeave={() => { if (!mobile) setExpanded(false); }}
      onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setExpanded(false); }}
      onKeyDown={(event) => { if (event.key === 'Escape') { event.preventDefault(); setExpanded(false); triggerRef.current?.focus(); } }}>
      <div className={`flex items-center ${mobile ? 'w-full' : ''}`}>
        <MenuLink item={item} className={linkClass} onClick={close} onFocus={() => { if (!mobile && children.length) setExpanded(true); }}>
          <span className={mobile ? 'block break-words' : 'inline-flex items-center whitespace-nowrap'}>{item.label}</span>
        </MenuLink>
        {children.length ? <button ref={triggerRef} type="button" aria-label={`${item.label} submenu`} aria-expanded={expanded} aria-controls={menuId} onClick={() => setExpanded((value) => !value)} onKeyDown={(event) => { if (event.key === 'ArrowDown') { event.preventDefault(); setExpanded(true); } }} className={`shrink-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400 ${mobile ? 'mr-2 flex h-12 w-12 items-center justify-center rounded-lg text-brand-blue hover:bg-blue-50' : 'rounded-md p-1 text-white/70 hover:text-white'}`}><ChevronDownIcon className={`h-3.5 w-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`} /></button> : null}
      </div>
      {children.length && expanded ? <div id={menuId} className={mobile ? 'w-full border-t border-slate-100 bg-slate-50/80 px-5 py-2' : `absolute ${alignEnd ? 'right-0' : 'left-0'} top-full z-[90] w-80 max-w-[85vw] pt-3`}>
        <div className={mobile ? 'w-full' : 'max-h-[65vh] overflow-y-auto rounded-b-2xl rounded-t-md border border-slate-200 border-t-[3px] border-t-brand-saffron bg-white py-2 text-slate-800 shadow-[0_20px_50px_-12px_rgba(15,23,42,.3)]'}>
          {!mobile ? <p className="px-5 pb-2 pt-2 text-[10px] font-bold uppercase tracking-[.18em] text-slate-400">Explore {item.label}</p> : null}
          {children.map((child) => <MenuLink key={child.id} item={child} onClick={close} className={({ isActive }) => `block w-full border-l-2 py-3.5 text-sm font-medium leading-relaxed transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400 ${mobile ? 'px-4' : 'px-5'} ${isActive ? 'border-brand-saffron bg-amber-50/70 text-brand-blue' : 'border-transparent text-slate-700 hover:border-brand-saffron hover:bg-slate-50 hover:text-brand-blue'}`}>{child.label}</MenuLink>)}
        </div>
      </div> : null}
    </div>
  );
};

export default WebsiteNavigationItem;