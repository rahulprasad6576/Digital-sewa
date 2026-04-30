// Premium Chatbot Enhancements
document.addEventListener('DOMContentLoaded', function() {
  const box = document.getElementById('chatbotBox');
  const toggle = document.querySelector('.chatbot-toggle');
  if (!box || !toggle) return;

  // Smooth animations
  toggle.addEventListener('click', function() {
    box.classList.toggle('active');
    if (box.classList.contains('active')) {
      box.style.animation = 'chatbotSlideIn 0.4s cubic-bezier(0.34, 1.56
