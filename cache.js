class Cache {
  constructor() {
    this.c = {}
  }

  has(key) {
    return this.c.hasOwnProperty(key)
  }

  set(key, value) {
    this.c[key] = value
  }

  get(key) {
    return this.c[key]
  }
}

module.exports = Cache