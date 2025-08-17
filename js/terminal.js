const terminal = document.getElementById('terminal');
const input = document.getElementById('terminalInput');

function print(text) {
    terminal.innerText += text + '\n';
    terminal.scrollTop = terminal.scrollHeight;
}

function handleCommand(cmd) {
    switch(cmd) {
        case 'help':
            print("Commands: about, projects, resume, skills, open <folder>, clear");
            break;
        case 'about':
            print("Hi, I'm Raelyaan, a pentester and hacker.");
            break;
        case 'projects':
            print("1. Project1\n2. Project2");
            break;
        case 'skills':
            print("Linux, Python, JS, Web Hacking, Networking");
            break;
        case 'resume':
            document.getElementById('resumeWindow').classList.remove('hidden');
            fetch('assets/resume.txt').then(res => res.text()).then(data => {
                document.getElementById('resumeContent').innerText = data;
            });
            break;
        case 'clear':
            terminal.innerText = '';
            break;
        default:
            if(cmd.startsWith('open ')){
                const folder = cmd.split(' ')[1];
                if(folder === 'projects') document.getElementById('projectWindow').classList.remove('hidden');
                else if(folder === 'resume') document.getElementById('resumeWindow').classList.remove('hidden');
                else print("Folder not found");
            } else {
                print("Command not found. Type 'help'");
            }
    }
}

input.addEventListener('keydown', (e) => {
    if(e.key === 'Enter') {
        const cmd = input.value.trim();
        print("> " + cmd);
        handleCommand(cmd);
        input.value = '';
    }
});

// Welcome message
print("Welcome to Raelyaan's Hacker Portfolio! Type 'help' to start.");
