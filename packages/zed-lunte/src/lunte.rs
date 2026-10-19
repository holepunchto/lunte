use std::env;
use zed_extension_api::{self as zed, settings::LspSettings, LanguageServerId, Result};

const PACKAGE: &str = "lunte-lsp";
const BIN: &str = "node_modules/lunte-lsp/bin/lunte-lsp";

#[derive(Debug, PartialEq)]
enum Server {
    Command(String, Vec<String>),
    Node(String),
    Managed,
}

// Settings override, then the project-local install (so the version matches the CLI),
// then a global install on PATH, then a managed install in the extension's work dir
fn resolve(
    configured: Option<(String, Vec<String>)>,
    local: Option<String>,
    on_path: Option<String>,
) -> Server {
    if let Some((path, args)) = configured {
        Server::Command(path, args)
    } else if let Some(bin) = local {
        Server::Node(bin)
    } else if let Some(path) = on_path {
        Server::Command(path, vec![])
    } else {
        Server::Managed
    }
}

struct Lunte {
    installed: bool,
}

impl Lunte {
    fn managed_bin(&mut self, id: &LanguageServerId) -> Result<String> {
        if !self.installed {
            let version = zed::npm_package_latest_version(PACKAGE)?;
            if zed::npm_package_installed_version(PACKAGE)?.as_deref() != Some(version.as_str()) {
                zed::set_language_server_installation_status(
                    id,
                    &zed::LanguageServerInstallationStatus::Downloading,
                );
                zed::npm_install_package(PACKAGE, &version)?;
            }
            self.installed = true;
        }
        let dir = env::current_dir().map_err(|e| e.to_string())?;
        Ok(dir.join(BIN).to_string_lossy().into_owned())
    }
}

impl zed::Extension for Lunte {
    fn new() -> Self {
        Lunte { installed: false }
    }

    fn language_server_command(
        &mut self,
        id: &LanguageServerId,
        worktree: &zed::Worktree,
    ) -> Result<zed::Command> {
        let configured = LspSettings::for_worktree("lunte", worktree)
            .ok()
            .and_then(|s| s.binary)
            .and_then(|b| Some((b.path?, b.arguments.unwrap_or_default())));
        let local = worktree
            .read_text_file("node_modules/lunte-lsp/package.json")
            .ok()
            .map(|_| format!("{}/{}", worktree.root_path(), BIN));

        let (command, args) = match resolve(configured, local, worktree.which(PACKAGE)) {
            Server::Command(path, args) => (path, args),
            Server::Node(bin) => (zed::node_binary_path()?, vec![bin]),
            Server::Managed => (zed::node_binary_path()?, vec![self.managed_bin(id)?]),
        };

        Ok(zed::Command {
            command,
            args,
            env: worktree.shell_env(),
        })
    }
}

zed::register_extension!(Lunte);

#[cfg(test)]
mod tests {
    use super::*;

    fn configured() -> Option<(String, Vec<String>)> {
        Some(("npx".into(), vec!["lunte-lsp".into()]))
    }

    fn local() -> Option<String> {
        Some("/project/node_modules/lunte-lsp/bin/lunte-lsp".into())
    }

    fn on_path() -> Option<String> {
        Some("/usr/local/bin/lunte-lsp".into())
    }

    #[test]
    fn settings_override_wins() {
        assert_eq!(
            resolve(configured(), local(), on_path()),
            Server::Command("npx".into(), vec!["lunte-lsp".into()])
        );
    }

    #[test]
    fn local_install_beats_path() {
        assert_eq!(
            resolve(None, local(), on_path()),
            Server::Node(local().unwrap())
        );
    }

    #[test]
    fn path_beats_managed() {
        assert_eq!(
            resolve(None, None, on_path()),
            Server::Command(on_path().unwrap(), vec![])
        );
    }

    #[test]
    fn falls_back_to_managed() {
        assert_eq!(resolve(None, None, None), Server::Managed);
    }
}
