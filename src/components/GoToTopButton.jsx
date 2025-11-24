import React, { useState, useEffect } from 'react';

const GoToTopButton = () => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const toggleVisibility = () => {
      // Check the page-container scroll instead of window scroll
      const pageContainer = document.querySelector('.page-container');
      if (pageContainer) {
        const scrollY = pageContainer.scrollTop;
        console.log('Page container scroll position:', scrollY); // Debug log
        
        if (scrollY > 200) {
          setIsVisible(true);
        } else {
          setIsVisible(false);
        }
      } else {
        // Fallback to window scroll if page-container not found
        const scrollY = window.pageYOffset || document.documentElement.scrollTop;
        // console.log('Window scroll position:', scrollY);
        
        if (scrollY > 200) {
          setIsVisible(true);
        } else {
          setIsVisible(false);
        }
      }
    };

    // Initial check
    toggleVisibility();

    // Listen to both window and page-container scroll
    window.addEventListener('scroll', toggleVisibility);
    
    const pageContainer = document.querySelector('.page-container');
    if (pageContainer) {
      pageContainer.addEventListener('scroll', toggleVisibility);
    }

    return () => {
      window.removeEventListener('scroll', toggleVisibility);
      if (pageContainer) {
        pageContainer.removeEventListener('scroll', toggleVisibility);
      }
    };
  }, []);

  const scrollToTop = () => {
    // Try to scroll the page-container first, then fallback to window
    const pageContainer = document.querySelector('.page-container');
    if (pageContainer) {
      pageContainer.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    } else {
      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    }
  };

  if (!isVisible) {
    return null;
  }

  return (
    <button
      onClick={scrollToTop}
      style={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        width: '50px',
        height: '50px',
        borderRadius: '50%',
        background: 'var(--accent)',
        color: '#000',
        border: '1px solid var(--card-border)',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '20px',
        fontWeight: 'bold',
        boxShadow: '0 4px 12px var(--card-shadow)',
        transition: 'all 0.3s ease',
        zIndex: 1000,
        backdropFilter: 'blur(10px)',
        opacity: 0.9
      }}
      onMouseEnter={(e) => {
        e.target.style.transform = 'translateY(-2px) scale(1.1)';
        e.target.style.boxShadow = '0 6px 20px var(--card-shadow)';
        e.target.style.opacity = '1';
      }}
      onMouseLeave={(e) => {
        e.target.style.transform = 'translateY(0) scale(1)';
        e.target.style.boxShadow = '0 4px 12px var(--card-shadow)';
        e.target.style.opacity = '0.9';
      }}
      aria-label="Go to top"
    >
      ↑
    </button>
  );
};

export default GoToTopButton;
