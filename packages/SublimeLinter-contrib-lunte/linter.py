from SublimeLinter.lint import NodeLinter

class Lunte(NodeLinter):
  cmd = 'lunte --stdin'
  name = 'Lunte'
  regex = r'^.+:(?P<line>\d+):(?P<col>\d+)\s\s(?P<message>.+)'

  defaults = {
    'enable_if_dependency': True,
    'disable_if_not_dependency': False,
    'selector': 'source.js, source.jsx'
  }
