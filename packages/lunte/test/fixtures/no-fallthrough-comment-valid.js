switch (value) {
  case 1:
    initialize()
    // falls through
  case 2:
    process()
    break
  default:
    cleanup()
}
