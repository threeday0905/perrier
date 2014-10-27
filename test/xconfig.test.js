/*describe('optional: ', function() {
    it('should ignore module not found error, if mark as optional', function() {
        load('./configs/not-exists.conf', __dirname, true);
        expect(logger.error.called).to.equal(false);
    });

    it('should log not found error, if not mark as optional', function() {
        load('./configs/not-exists.conf', __dirname, false);
        expect(logger.error.called).to.equal(true);
    });

    it('should log parse failed error, even if mark as optional', function() {
        load('./configs/syntax-error.conf', __dirname, true);
        expect(logger.error.called).to.equal(true);
    });
});
*/
