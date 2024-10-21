var Sampler = function() {
    this.startTime = this.lastTime = Date.now();
    this.samples = {};
}
Sampler.prototype.sample = function(name) {
    var now = Date.now();
    this.samples[name] = now - this.lastTime;
    this.totalTime = now - this.startTime;
    this.lastTime = now;
}
module.exports = Sampler;