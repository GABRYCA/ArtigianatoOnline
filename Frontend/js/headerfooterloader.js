/**
 * Inizializza header e footer della pagina
 */
$(function () {
    $("#header-placeholder").load("common/header.html", function () {
        let paginaCorrente = window.location.pathname.split("/").pop();
        if (paginaCorrente === "") {
            paginaCorrente = "index.html";
        }
        $('#header-placeholder .nav-link').each(function () {
            const linkPagina = $(this).attr('href');
            if (linkPagina === paginaCorrente) {
                $(this).addClass('active');
                $(this).attr('aria-current', 'page');
            }
        });
    });

    $("#footer-placeholder").load("common/footer.html");
});