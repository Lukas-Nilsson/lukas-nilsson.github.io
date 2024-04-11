

// document.addEventListener('DOMContentLoaded', () => {
//     const observer = new IntersectionObserver((entries, observer) => {
//       entries.forEach(entry => {
//         if (entry.isIntersecting) {
//           const img = entry.target;
//           const highQualitySrc = img.dataset.src;
//           img.src = highQualitySrc;
//           img.onload = () => {
//             img.removeAttribute('data-src');
//             img.classList.add('loaded'); // Add a 'loaded' class after the image is loaded
//           };
//           observer.unobserve(entry.target);
//         }
//       });
//     }, {
//       threshold: 0.5,
//       rootMargin: '100px' // Adjust the value to load the content slightly earlier
//     });
  
//     document.querySelectorAll('img[data-src]').forEach(img => {
//       observer.observe(img);
//     });
  

//   });

  // let snapDivTop = document.querySelector('.no-scroll-container').getBoundingClientRect().top;
  // let snapDivBottom = document.querySelector('.no-scroll-container').getBoundingClientRect().bottom;
  
  // let lastScrollTop = window.scrollY;
  // let ticking = false;
  
  // window.addEventListener('scroll', () => {
  //   lastScrollTop = window.scrollY;
  
  //   if (!ticking) {
  //     window.requestAnimationFrame(() => {
  //       updateScrollPosition();
  //       ticking = false;
  //     });
  //     ticking = true;
  //   }
  // });
  
  // function updateScrollPosition() {
  //   let scrollTop = lastScrollTop;
  //   let scrollHeight = document.documentElement.scrollHeight;
  //   let windowHeight = window.innerHeight;
  
  //   if (scrollTop < snapDivTop || scrollTop + windowHeight >= snapDivBottom) {
  //     window.scrollTo(0, scrollTop + ((scrollHeight - snapDivBottom + windowHeight) * (scrollTop - snapDivTop) / (windowHeight - snapDivTop)));
  //   }
  // }