document.addEventListener("DOMContentLoaded", () => {
  const terminalCommands = {
    help: `Available commands:
- help .......... show this help
- whoami ........ show user info
- about ......... info about Aadil Asif Badhra
- projects ...... list portfolio projects
- resume ........ open resume
- clear ......... clear terminal
- ls ............ list desktop items
- cd [folder] ... navigate folders
- echo [text] ... print text`,

    whoami: "aadil@portfolio:~$ Hacker | Developer | Pentester",
    about: "Name: Aadil Asif Badhra\nRole: Ethical Hacker & Developer\nPassionate about cybersecurity and full-stack development.",
    projects: "1. Web Security Scanner\n2. Linux Portfolio Desktop\n3. E-Commerce Heatmap\n4. Auditorium PWA",
    resume: "Opening Resume window...",
    ls: "Projects  Resume  About  Terminal",
  };

  // Launch terminal window
  window.launchTerminal = function () {
    const termWin = createWindow("Terminal", true);
    const content = document.createElement("div");
    content.classList.add("terminal");
    termWin.querySelector(".window-content").appendChild(content);

    content.innerHTML = `
      <div id="terminal-output"></div>
      <div id="terminal-input-line">
        <span class="prompt">aadil@portfolio:~$</span>
        <input type="text" id="terminal-input" autofocus />
      </div>
    `;

    const output = content.querySelector("#terminal-output");
    const input = content.querySelector("#terminal-input");

    input.focus();

    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        const cmd = input.value.trim();
        output.innerHTML += `<div><span class="prompt">aadil@portfolio:~$</span> ${cmd}</div>`;
        processCommand(cmd, output);
        input.value = "";
        content.scrollTop = content.scrollHeight;
      }
    });
  };

  // Process commands
  function processCommand(cmd, output) {
    if (!cmd) return;

    const parts = cmd.split(" ");
    const base = parts[0];
    const arg = parts[1];

    switch (base) {
      case "help":
      case "whoami":
      case "about":
      case "projects":
      case "ls":
        output.innerHTML += `<div>${terminalCommands[base]}</div>`;
        break;

      case "resume":
        output.innerHTML += `<div>${terminalCommands.resume}</div>`;
        // Open Resume window
        const resumeWin = createWindow("Resume");
        resumeWin.querySelector(".window-content").innerHTML = `
          <h2>Resume</h2>
          <p>[Here you can embed or link your PDF Resume]</p>
        `;
        break;

      case "clear":
        output.innerHTML = "";
        break;

      case "cd":
        if (arg) {
          output.innerHTML += `<div>Changed directory to ${arg}/</div>`;
        } else {
          output.innerHTML += `<div>cd: missing argument</div>`;
        }
        break;

      case "echo":
        output.innerHTML += `<div>${cmd.replace("echo ", "")}</div>`;
        break;

      default:
        output.innerHTML += `<div>Command not found: ${cmd}</div>`;
    }
  }
});
