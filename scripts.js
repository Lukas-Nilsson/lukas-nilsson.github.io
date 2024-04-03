// var delay = "1000px"; // adjust this to set the delay

// var observerOptions = {
//   rootMargin: "-"+delay+" 0px -"+delay+" 0px 0px" // expanded toward top and bottom
// };

// let observer = new IntersectionObserver((entries, observer) => {
//     entries.forEach(entry => {
//         // Execute parallax scroll if in view
//         if (entry.isIntersecting){
//           // Featured Parallax
//           // (insert your parallax code here)
          
//           // ...

//           observer.unobserve(entry.target);
//         }
//     });
// }, {threshold: 0.1});

// // Observe all your parallax layers
// const layers = document.querySelectorAll('.pc-layer','.pc-flyer','.stars-img');  // Replace ".parallax" with the actual class or IDs of your layers
// layers.forEach(layer => {
//     observer.observe(layer);
// });

// document.addEventListener('scroll', function() {
    
//     //Featured Parallax
//     const backgroundSpeed = 0.4; // Adjust this value for background movement speed
//     const foregroundSpeed = 0.3; // Adjust this value for foreground movement speed

//     //flying 
//     const oneone = 0.79; // Adjust this value for background movement speed
//     const onetwo = 0.79; // Adjust this value for foreground movement speed
//     const onethree = 0.79; // Adjust this value for background movement speed
//     const twoone = 0.79; // Adjust this value for background movement speed
//     const twotwo = 0.79; // Adjust this value for foreground movement speed    
//     const twothree = 0.79; // Adjust this value for foreground movement speed    
//     const twofour = 0.79; // Adjust this value for background movement speed
//     const threeone = 0.79; // Adjust this value for foreground movement speed    
//     const threetwo = 0.79; // Adjust this value for background movement speed

//     //layers
//     const stars = 0.76; // Stars fall the slowestquickest
//     const one = 0.81; // Adjust this value for foreground movement speed    
//     const two = 0.8; // Adjust this value for background movement speed
//     const three = 0.79; // Adjust this value for foreground movement speed    
//     const four = 0.78; // Adjust this value for background movement speed
//     const five = 0.77; // Adjust this value for foreground movement speed    
//     const six = 0.76; // Adjust this value for background movement speed

//     //flying getID
//     const flyer11 = document.getElementById('pc-1-1');
//     const flyer12 = document.getElementById('pc-1-2');
//     const flyer13 = document.getElementById('pc-1-3');
//     const flyer21 = document.getElementById('pc-2-1');
//     const flyer22 = document.getElementById('pc-2-2');
//     const flyer23 = document.getElementById('pc-2-3');
//     const flyer24 = document.getElementById('pc-2-4');
//     const flyer31 = document.getElementById('pc-3-1');
//     const flyer32 = document.getElementById('pc-3-2');

//     const background = document.getElementById('parallax1');
//     const foreground = document.getElementById('parallax2');

//     background.style.transform = `translateY(${window.scrollY * backgroundSpeed}px)`;
//     foreground.style.transform = `translateY(${window.scrollY * foregroundSpeed}px)`;

//     //Collage Parallax




//     //layers getID
//     const backgroundStars = document.getElementById('pc-stars');
//     const layer1 = document.getElementById('pc-1-layer');
//     const layer2 = document.getElementById('pc-2-layer');
//     const layer3 = document.getElementById('pc-3-layer');
//     const layer4 = document.getElementById('pc-4-layer');
//     const layer5 = document.getElementById('pc-5-layer');
//     const layer6 = document.getElementById('pc-6-layer');

//     //flying compute transform
//     flyer11.style.transform = `translateY(${window.scrollY * oneone}px)`;
//     flyer12.style.transform = `translateY(${window.scrollY * onetwo}px)`;
//     flyer13.style.transform = `translateY(${window.scrollY * onethree}px)`;
//     flyer21.style.transform = `translateY(${window.scrollY * twoone}px)`;
//     flyer22.style.transform = `translateY(${window.scrollY * twotwo}px)`;
//     flyer23.style.transform = `translateY(${window.scrollY * twothree}px)`;
//     flyer24.style.transform = `translateY(${window.scrollY * twofour}px)`;
//     flyer31.style.transform = `translateY(${window.scrollY * threeone}px)`;
//     flyer32.style.transform = `translateY(${window.scrollY * threetwo}px)`;

//     //layers compute transform
//     backgroundStars.style.transform = `translateY(${window.scrollY * stars}px)`;
//     layer1.style.transform = `translateY(${window.scrollY * one}px)`;
//     layer2.style.transform = `translateY(${window.scrollY * two}px)`;
//     layer3.style.transform = `translateY(${window.scrollY * three}px)`;
//     layer4.style.transform = `translateY(${window.scrollY * four}px)`;
//     layer5.style.transform = `translateY(${window.scrollY * five}px)`;
//     layer6.style.transform = `translateY(${window.scrollY * six}px)`;

// });


document.addEventListener('DOMContentLoaded', function() {
    let observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                // Entry is in viewport
                entry.target.classList.add('active-parallax');
            } else {
                // Entry is not in viewport
                entry.target.classList.remove('active-parallax');
            }
        });
    }, { threshold: 0.01 });

    // Selecting elements that should have parallax effect
    const parallaxElements = document.querySelectorAll('.parallaxCollage .pc-flyer-img, .parallaxCollage .pc-layer-img, .parallaxCollage .pc-stars-img');
        parallaxElements.forEach(element => {
        observer.observe(element);
    });

    // Applying the parallax effect on scroll to elements that have the `active-parallax` class
    document.addEventListener('scroll', () => {
        document.querySelectorAll('.active-parallax').forEach(element => {
            // Using data-speed attribute to control the rate of parallax effect
            const speed = parseFloat(element.getAttribute('data-speed'));
            const yPos = ((window.scrollY - element.getBoundingClientRect().top) * speed);
            element.style.transform = `translateY(${yPos}px)`;
        });
    });
});