// PROJECT VIDEO LOGIC
document.querySelectorAll('.project-card').forEach(card => {
  const thumbnail = card.querySelector('.thumbnail');
  const videoContainer = card.querySelector('.video-container');
  const backBtn = card.querySelector('.back-btn');

  thumbnail.addEventListener('click', () => {
    thumbnail.style.display = 'none';
    videoContainer.style.display = 'block';
  });

  backBtn.addEventListener('click', () => {
    const video = videoContainer.querySelector('video');
    video.pause();
    video.currentTime = 0;
    videoContainer.style.display = 'none';
    thumbnail.style.display = 'block';
  });
});

console.log("Projects gallery loaded");
