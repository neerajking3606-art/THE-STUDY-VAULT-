document.addEventListener("DOMContentLoaded", () => {
    // Inject the fixed logo
    const logoContainer = document.createElement("div");
    logoContainer.style.position = "fixed";
    logoContainer.style.top = "20px";
    logoContainer.style.right = "20px";
    logoContainer.style.zIndex = "9999";
    logoContainer.style.cursor = "pointer";
    logoContainer.style.transition = "transform 0.3s ease";

    const logoImg = document.createElement("img");
    logoImg.src = "/images/logo.jpg";
    logoImg.alt = "The Study Vault Logo";
    logoImg.style.width = "80px";
    logoImg.style.height = "auto";
    logoImg.style.borderRadius = "12px";
    logoImg.style.boxShadow = "0 8px 25px rgba(0,0,0,0.5)";
    logoImg.style.border = "2px solid rgba(124,58,237,0.4)";
    logoImg.style.background = "#0f172a"; // Add background in case of transparent png

    // Hover effect
    logoContainer.onmouseover = () => logoContainer.style.transform = "scale(1.1) rotate(5deg)";
    logoContainer.onmouseleave = () => logoContainer.style.transform = "scale(1) rotate(0deg)";

    // Link back to home
    logoContainer.onclick = () => window.location.href = "/";

    logoContainer.appendChild(logoImg);
    document.body.appendChild(logoContainer);
});
