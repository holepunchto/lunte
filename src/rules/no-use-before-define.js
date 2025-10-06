export const noUseBeforeDefine = {
  meta: {
    name: 'no-use-before-define',
    description: 'Disallow using variables before they are defined.',
    recommended: true,
  },
  create(context) {
    return {
      // Visitor placeholders; implementation arrives once scope tracking exists.
      Identifier(node) {
        void node;
        void context;
      },
    };
  },
};
