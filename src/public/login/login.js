const form = document.getElementById("loginForm");
    const button = document.getElementById("loginButton");
    const errorMessage = document.getElementById("errorMessage");
    const successMessage = document.getElementById("successMessage");

    function showError(message) {
      errorMessage.textContent = message;
      errorMessage.style.display = "block";
      successMessage.style.display = "none";
    }

    function showSuccess() {
      errorMessage.style.display = "none";
      successMessage.style.display = "block";
    }

    form.addEventListener("submit", async (event) => {
      event.preventDefault();

      const username = document.getElementById("username").value.trim();
      const password = document.getElementById("password").value;

      button.disabled = true;
      button.textContent = "Connexion...";

      try {
        const response = await fetch("/dashboard/login", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          credentials: "include",
          body: JSON.stringify({
            username,
            password
          })
        });

        const data = await response.json().catch(() => null);

        if (!response.ok) {
          showError(data?.error || "Identifiants invalides");
          return;
        }

        showSuccess();

        setTimeout(() => {
          window.location.href = "/dashboard/";
        }, 500);
      } catch (error) {
        showError("Erreur de connexion au serveur");
      } finally {
        button.disabled = false;
        button.textContent = "Connexion";
      }
    });