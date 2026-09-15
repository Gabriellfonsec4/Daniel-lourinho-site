/* CONFIGURAÇÕES DO SITE */

const CONFIG = {
  whatsapp: "5521999999999",

  openingHour: 9,

  closingHour: 19,

  intervalMinutes: 60,

  closedWeekdays: [0],

  supabaseUrl: "",

  supabaseAnonKey: "",
};

/* ELEMENTOS DA PÁGINA */

const $ = (selector) => document.querySelector(selector);

const dateInput = $("#date");

const serviceInput = $("#service");

const slotsContainer = $("#slots");

const form = $("#booking-form");

const statusMessage = $("#form-status");

let chosenTime = "";

/* DATA MÍNIMA */

const today = new Date();

today.setHours(0, 0, 0, 0);

dateInput.min = today.toISOString().split("T")[0];

/* ANO DO RODAPÉ */

$("#year").textContent = new Date().getFullYear();

/* MENU MOBILE */

$(".menu-btn").addEventListener("click", () => {
  const menuIsOpen = $(".nav").classList.toggle("open");

  $(".menu-btn").setAttribute("aria-expanded", menuIsOpen);

  document.body.classList.toggle("menu-open", menuIsOpen);
});

document.querySelectorAll(".nav a").forEach((link) => {
  link.addEventListener("click", () => {
    $(".nav").classList.remove("open");

    $(".menu-btn").setAttribute("aria-expanded", "false");

    document.body.classList.remove("menu-open");
  });
});

/* ANIMAÇÃO AO ROLAR */

const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("visible");
      }
    });
  },

  {
    threshold: 0.12,
  },
);

document.querySelectorAll(".reveal").forEach((element) => {
  observer.observe(element);
});

/* RESERVAS SALVAS NO NAVEGADOR */

function getLocalBookings() {
  return JSON.parse(localStorage.getItem("danielBookings") || "[]");
}

/* CONSULTAR HORÁRIOS OCUPADOS */

async function getBookedTimes(date) {
  if (CONFIG.supabaseUrl && CONFIG.supabaseAnonKey) {
    const url =
      `${CONFIG.supabaseUrl}/rest/v1/bookings` + `?date=eq.${date}&select=time`;

    const response = await fetch(url, {
      headers: {
        apikey: CONFIG.supabaseAnonKey,

        Authorization: `Bearer ${CONFIG.supabaseAnonKey}`,
      },
    });

    if (!response.ok) {
      throw new Error("Não foi possível consultar a agenda");
    }

    const bookings = await response.json();

    return bookings.map((booking) => {
      return booking.time.slice(0, 5);
    });
  }

  return getLocalBookings()
    .filter((booking) => {
      return booking.date === date;
    })

    .map((booking) => {
      return booking.time;
    });
}

/* MOSTRAR HORÁRIOS */

async function showSlots() {
  chosenTime = "";

  slotsContainer.innerHTML = `
    <p class="slot-help">
      Carregando horários...
    </p>
  `;

  updateSummary();

  if (!dateInput.value) {
    slotsContainer.innerHTML = `
      <p class="slot-help">
        Escolha uma data para ver os horários.
      </p>
    `;

    return;
  }

  const selectedDate = new Date(dateInput.value + "T12:00:00");

  if (CONFIG.closedWeekdays.includes(selectedDate.getDay())) {
    slotsContainer.innerHTML = `
      <p class="slot-help">
        Não atendemos neste dia.
        Escolha outra data.
      </p>
    `;

    return;
  }

  try {
    const unavailableTimes = await getBookedTimes(dateInput.value);

    slotsContainer.innerHTML = "";

    for (
      let minutes = CONFIG.openingHour * 60;
      minutes < CONFIG.closingHour * 60;
      minutes += CONFIG.intervalMinutes
    ) {
      const hour = String(Math.floor(minutes / 60)).padStart(2, "0");

      const minute = String(minutes % 60).padStart(2, "0");

      const time = `${hour}:${minute}`;

      const button = document.createElement("button");

      button.type = "button";

      button.className = "slot";

      button.textContent = time;

      button.disabled = unavailableTimes.includes(time);

      button.title = button.disabled
        ? "Horário indisponível"
        : `Selecionar ${time}`;

      button.addEventListener("click", () => {
        document.querySelectorAll(".slot").forEach((slot) => {
          slot.classList.remove("active");
        });

        button.classList.add("active");

        chosenTime = time;

        updateSummary();
      });

      slotsContainer.appendChild(button);
    }
  } catch (error) {
    slotsContainer.innerHTML = `
      <p class="slot-help">
        ${error.message}. Tente novamente.
      </p>
    `;
  }
}

/* ATUALIZAR RESUMO */

function updateSummary() {
  const service = serviceInput.value.split("|")[0];

  const formattedDate = dateInput.value
    ? new Date(dateInput.value + "T12:00:00").toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "short",
      })
    : "";

  const bookingInformation = [service, formattedDate, chosenTime]
    .filter(Boolean)
    .join(" • ");

  $("#summary strong").textContent =
    bookingInformation || "Selecione serviço, data e horário";
}

dateInput.addEventListener("change", showSlots);

serviceInput.addEventListener("change", updateSummary);

/* SALVAR AGENDAMENTO */

async function saveBooking(data) {
  if (CONFIG.supabaseUrl && CONFIG.supabaseAnonKey) {
    const response = await fetch(
      `${CONFIG.supabaseUrl}/rest/v1/bookings`,

      {
        method: "POST",

        headers: {
          apikey: CONFIG.supabaseAnonKey,

          Authorization: `Bearer ${CONFIG.supabaseAnonKey}`,

          "Content-Type": "application/json",

          Prefer: "return=minimal",
        },

        body: JSON.stringify(data),
      },
    );

    if (!response.ok) {
      if (response.status === 409) {
        throw new Error("Este horário acabou de ser reservado.");
      }

      throw new Error("Não foi possível realizar a reserva.");
    }
  } else {
    const bookings = getLocalBookings();

    const alreadyBooked = bookings.some((booking) => {
      return booking.date === data.date && booking.time === data.time;
    });

    if (alreadyBooked) {
      throw new Error("Este horário está indisponível.");
    }

    bookings.push(data);

    localStorage.setItem(
      "danielBookings",

      JSON.stringify(bookings),
    );
  }
}

/* ENVIAR AGENDAMENTO */

form.addEventListener(
  "submit",

  async (event) => {
    event.preventDefault();

    statusMessage.className = "form-status";

    statusMessage.textContent = "";

    if (!chosenTime) {
      statusMessage.textContent = "Escolha um horário disponível.";

      statusMessage.classList.add("error");

      return;
    }

    const serviceInformation = serviceInput.value.split("|");

    const service = serviceInformation[0];

    const price = serviceInformation[1];

    const bookingData = {
      name: $("#name").value.trim(),

      service: service,

      price: Number(price),

      date: dateInput.value,

      time: chosenTime,
    };

    try {
      await saveBooking(bookingData);

      statusMessage.textContent = "Horário reservado! Abrindo o WhatsApp...";

      const formattedDate = new Date(
        bookingData.date + "T12:00:00",
      ).toLocaleDateString("pt-BR");

      const message =
        `Olá, Daniel! Sou ${bookingData.name}. ` +
        `Acabei de solicitar um agendamento pelo site.` +
        `%0A%0A` +
        `✂️ Serviço: ${bookingData.service}` +
        `%0A` +
        `📅 Data: ${formattedDate}` +
        `%0A` +
        `🕐 Horário: ${bookingData.time}` +
        `%0A` +
        `💰 Valor: R$ ${bookingData.price},00` +
        `%0A%0A` +
        `Pode confirmar meu horário?`;

      const whatsappUrl =
        `https://wa.me/${CONFIG.whatsapp}` + `?text=${message}`;

      setTimeout(() => {
        window.open(whatsappUrl, "_blank");
      }, 350);

      await showSlots();
    } catch (error) {
      statusMessage.textContent = error.message;

      statusMessage.classList.add("error");

      await showSlots();
    }
  },
);
