function loadHTML(file, elementId) {
    fetch(file)
        .then(response => {
            if (!response.ok) {
                throw new Error(`Error fetching ${file}: ${response.statusText}`);
            }
            return response.text();
        })
        .then(data => {
            //document.getElementById(elementId).innerHTML = data;
			document.getElementById(elementId).innerHTML = data;
			  Array.from(document.getElementById(elementId).querySelectorAll("script")).forEach(oldScript => {
				const newScript = document.createElement("script");
				Array.from(oldScript.attributes)
				  .forEach(attr => newScript.setAttribute(attr.name, attr.value));
				newScript.appendChild(document.createTextNode(oldScript.innerHTML));
				oldScript.parentNode.replaceChild(newScript, oldScript);
			  });
			
			
        })
        .catch(error => console.error(error));
}


document.addEventListener("DOMContentLoaded", function() {
    loadHTML('/lab/header.html', 'header-placeholder');
    loadHTML('/lab/footer.html', 'footer-placeholder');
	//init();
});


//window.onload = function () {
//	handleMenu();
//};
