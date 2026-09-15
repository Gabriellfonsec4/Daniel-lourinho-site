/* CONFIGURAÇÕES DO SUPABASE */

const SUPABASE_URL = "https://SEU-PROJETO.supabase.co";

const SUPABASE_ANON_KEY = "SUA-CHAVE-ANON";

/* INICIAR SUPABASE */

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
);

/* ELEMENTOS */

const $ = (selector) => document.querySelector(selector);

const loginView = $("#login");

const dashboardView = $("#dashboard");

const bookingList = $("#booking-list");

const filterDate = $("#filter-date");

const dashboardMessage = $("#dashboard-message");

/* DATA LOCAL */

function getLocalDateValue(date = new Date()) {
  const timezoneOffset = date.getTimezoneOffset();

  const localDate = new Date(date.getTime() - timezoneOffset * 60000);

  return localDate.toISOString().split("T")[0];
}

filterDate.value = getLocalDateValue();

/* VERIFICAR LOGIN */

async function showCorrectView() {
  const {
    data: { session },
  } = await supabaseClient.auth.getSession();

  const isLoggedIn = Boolean(session);

  loginView.classList.toggle("hidden", isLoggedIn);

  dashboardView.classList.toggle("hidden", !isLoggedIn);

  if (isLoggedIn) {
    loadBookings();
  }
}

/* REALIZAR LOGIN */

$("#login-form").addEventListener(
  "submit",

  async (event) => {
    event.preventDefault();

    const loginMessage = $("#login-message");

    const button = event.currentTarget.querySelector("button");

    loginMessage.textContent = "";

    button.disabled = true;

    button.textContent = "Entrando...";

    const email = $("#email").value.trim();

    const password = $("#password").value;

    const { error } = await supabaseClient.auth.signInWithPassword({
      email: email,

      password: password,
    });

    button.disabled = false;

    button.textContent = "Entrar";

    if (error) {
      loginMessage.textContent = "E-mail ou senha incorretos.";

      return;
    }

    showCorrectView();
  },
);

/* SAIR DO PAINEL */

$("#logout").addEventListener(
  "click",

  async () => {
    await supabaseClient.auth.signOut();

    showCorrectView();
  },
);

/* BOTÃO HOJE */

$("#today").addEventListener(
  "click",

  () => {
    filterDate.value = getLocalDateValue();

    loadBookings();
  },
);

/* ATUALIZAR */

$("#refresh").addEventListener("click", loadBookings);

/* TROCAR DATA */

filterDate.addEventListener("change", loadBookings);

/* CARREGAR AGENDAMENTOS */

async function loadBookings() {
  bookingList.innerHTML = `
    <p class="empty">
      Carregando agenda...
    </p>
  `;

  dashboardMessage.textContent = "";

  /*
    Esta função também atualiza como expiradas
    as solicitações que passaram de 30 minutos.
  */

  await supabaseClient.rpc("unavailable_times", {
    p_date: filterDate.value,
  });

  const { data: bookings, error } = await supabaseClient

    .from("bookings")

    .select("*")

    .eq("date", filterDate.value)

    .order("time", {
      ascending: true,
    });

  if (error) {
    bookingList.innerHTML = `
      <p class="empty">
        Não foi possível carregar a agenda.
      </p>
    `;

    return;
  }

  renderBookings(bookings);
}

/* MOSTRAR AGENDAMENTOS */

function renderBookings(bookings) {
  const activeBookings = bookings.filter((booking) => {
    return ["pending", "confirmed"].includes(booking.status);
  });

  const pendingBookings = activeBookings.filter((booking) => {
    return booking.status === "pending";
  });

  const confirmedBookings = activeBookings.filter((booking) => {
    return booking.status === "confirmed";
  });

  $("#pending-count").textContent = pendingBookings.length;

  $("#confirmed-count").textContent = confirmedBookings.length;

  $("#total-count").textContent = activeBookings.length;

  if (bookings.length === 0) {
    bookingList.innerHTML = `
      <p class="empty">
        Nenhum agendamento nesta data.
      </p>
    `;

    return;
  }

  const statusLabels = {
    pending: "Aguardando",

    confirmed: "Confirmado",

    cancelled: "Cancelado",

    expired: "Expirado",
  };

  bookingList.innerHTML = bookings

    .map((booking) => {
      let expirationInformation = "";

      if (booking.status === "pending") {
        const expirationTime = new Date(booking.expires_at).toLocaleTimeString(
          "pt-BR",
          {
            hour: "2-digit",
            minute: "2-digit",
          },
        );

        expirationInformation = `
            <span>
              Expira às ${expirationTime}
            </span>
          `;
      }

      let actionButtons = "";

      if (booking.status === "pending") {
        actionButtons = `
            <div class="actions">

              <button
                class="confirm"
                data-id="${booking.id}"
                data-status="confirmed"
                type="button"
              >
                Confirmar
              </button>

              <button
                class="cancel"
                data-id="${booking.id}"
                data-status="cancelled"
                type="button"
              >
                Cancelar
              </button>

            </div>
          `;
      }

      if (booking.status === "confirmed") {
        actionButtons = `
            <div class="actions">

              <button
                class="cancel"
                data-id="${booking.id}"
                data-status="cancelled"
                type="button"
              >
                Cancelar
              </button>

            </div>
          `;
      }

      return `
          <article class="booking-item">

            <div class="booking-time">

              ${booking.time.slice(0, 5)}

            </div>

            <div class="booking-info">

              <h2>
                ${escapeHtml(booking.name)}
              </h2>

              <p>

                ${escapeHtml(booking.service)}

                •

                R$ ${Number(booking.price).toFixed(2).replace(".", ",")}

              </p>

              <small>

                <span
                  class="badge ${booking.status}"
                >
                  ${statusLabels[booking.status]}
                </span>

                ${expirationInformation}

              </small>

            </div>

            ${actionButtons}

          </article>
        `;
    })

    .join("");

  document.querySelectorAll("[data-status]").forEach((button) => {
    button.addEventListener(
      "click",

      () => {
        updateBooking(button);
      },
    );
  });
}

/* CONFIRMAR OU CANCELAR */

async function updateBooking(button) {
  button.disabled = true;

  const bookingId = button.dataset.id;

  const newStatus = button.dataset.status;

  const changes = {
    status: newStatus,
  };

  if (newStatus === "confirmed") {
    changes.confirmed_at = new Date().toISOString();
  }

  const { error } = await supabaseClient

    .from("bookings")

    .update(changes)

    .eq("id", bookingId);

  if (error) {
    dashboardMessage.textContent = "Não foi possível atualizar o agendamento.";
  } else {
    dashboardMessage.textContent =
      newStatus === "confirmed"
        ? "Agendamento confirmado."
        : "Agendamento cancelado.";
  }

  await loadBookings();
}

/* PROTEÇÃO PARA NOMES E TEXTOS */

function escapeHtml(value) {
  return String(value).replace(
    /[&<>'"]/g,

    (character) =>
      ({
        "&": "&amp;",

        "<": "&lt;",

        ">": "&gt;",

        "'": "&#39;",

        '"': "&quot;",
      })[character],
  );
}

/* MONITORAR LOGIN */

supabaseClient.auth.onAuthStateChange(() => {
  showCorrectView();
});

showCorrectView();
