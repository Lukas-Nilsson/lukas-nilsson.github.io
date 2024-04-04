

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
      rootMargin: '200px' // Adjust the value to load the content slightly earlier
    });
  
    document.querySelectorAll('img[data-src]').forEach(img => {
      observer.observe(img);
    });
  
    // const applyParallaxEffect = (element) => {
    //   // Apply the parallax effect only if the image is loaded
    //   if (element.classList.contains('loaded')) {
    //     const speed = parseFloat(element.getAttribute('data-speed'));
    //     const yPos = -(window.scrollY - element.getBoundingClientRect().top) * speed;
    //     element.style.transform = `translateY(${yPos}px)`;
    //   }
    // };
  
    // window.addEventListener('scroll', () => {
    //   document.querySelectorAll('.parallax-container .pc-layer-img, .parallax-container .pc-stars-img, .parallax-container .pc-flyer-img').forEach(applyParallaxEffect);
    // });
  });