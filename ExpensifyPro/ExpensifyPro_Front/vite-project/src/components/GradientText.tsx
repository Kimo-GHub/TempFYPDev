import { motion } from "framer-motion";

type GradientTextProps = {
  text: string;
  gradientColors?: string[];
  className?: string;
};

function GradientMarqueeText({
  text,
  gradientColors = ["#ff0080", "#7928ca", "#ff0080"],
  className = "",
}: GradientTextProps) {
  return (
    <span className={`inline-block whitespace-nowrap ${className}`}>
      <motion.span
        animate={{
          backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"],
        }}
        transition={{
          duration: 5,
          ease: "linear",
          repeat: Infinity,
        }}
        style={{
          backgroundImage: `linear-gradient(90deg, ${gradientColors.join(", ")})`,
          backgroundSize: "200% 100%",
          backgroundClip: "text",
          WebkitBackgroundClip: "text",
          color: "transparent",
        }}
      >
        {text}
      </motion.span>
    </span>
  );
}

export default function AnimatedGradientText(props: GradientTextProps) {
  return <GradientMarqueeText {...props} />;
}
