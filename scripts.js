

document.addEventListener('DOMContentLoaded', () => {
    const observer = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target;
          const highQualitySrc = img.dataset.src;
          img.src = highQualitySrc;
          img.onload = () => {
            img.removeAttribute('data-src');
            img.classList.add('loaded'); // Add a 'loaded' class after the image is loaded
          };
          observer.unobserve(entry.target);
        }
      });
    }, {
      threshold: 0.5,
      rootMargin: '100px' // Adjust the value to load the content slightly earlier
    });
  
    document.querySelectorAll('img[data-src]').forEach(img => {
      observer.observe(img);
    });
  

  });