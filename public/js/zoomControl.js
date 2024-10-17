// //minimum and maximum zoom levels
// const minZoom = 0.75; // 75% minimum zoom
// const maxZoom = 1.25; // 125% maximum zoom
//
// // Function to handle zoom scaling
// function handleZoom() {
//     const currentZoom = window.outerWidth / window.innerWidth;
//
//     if (currentZoom < minZoom) {
//         document.body.style.transform = `scale(${minZoom})`;
//         document.body.style.transformOrigin = '0 0'; // Ensure scaling is from the top left corner
//     } else if (currentZoom > maxZoom) {
//         document.body.style.transform = `scale(${maxZoom})`;
//         document.body.style.transformOrigin = '0 0';
//     } else {
//         document.body.style.transform = 'scale(1)';
//     }
// }
//
// // Attach event listener to resize
// window.addEventListener('resize', handleZoom);
//
// // Initial call to handle the default zoom
// handleZoom();
